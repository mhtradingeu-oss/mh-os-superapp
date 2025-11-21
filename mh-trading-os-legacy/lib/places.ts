import { GoogleSheetsService } from './sheets.js';
import { retryWithBackoff } from './retry.js';

/**
 * Google Places API Integration
 * Provides search and normalization for lead generation
 */

const PLACES_API_KEY = process.env.API_PLACES_KEY;
const PLACES_API_BASE = 'https://places.googleapis.com/v1';

// Rate limiting: 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second

// New Places API response structure
interface PlacesResult {
  id?: string; // place ID in new format: places/ChIJ...
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  types?: string[];
}

interface PlacesSearchParams {
  city: string;
  country: string;
  keywords: string[];
  radiusKm?: number;
}

/**
 * Rate limiter - ensures 1 req/sec limit
 */
async function rateLimitWait(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Check if Places API is available
 */
export function isPlacesApiAvailable(): boolean {
  return !!PLACES_API_KEY && PLACES_API_KEY.length > 0;
}

/**
 * Search for places using Google Places Text Search API (New)
 * With retry logic and per-keyword error isolation
 */
export async function searchPlaces(params: PlacesSearchParams): Promise<PlacesResult[]> {
  if (!isPlacesApiAvailable()) {
    throw new Error('Places API key not configured');
  }

  const results: PlacesResult[] = [];
  const errors: string[] = [];
  const radiusMeters = (params.radiusKm || 15) * 1000;

  // Search for each keyword with error isolation
  for (const keyword of params.keywords) {
    try {
      await rateLimitWait();

      const query = `${keyword} in ${params.city}, ${params.country}`;
      const url = `${PLACES_API_BASE}/places:searchText`;

      // New API requires field mask to specify what data to return
      const fieldMask = [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.internationalPhoneNumber',
        'places.websiteUri',
        'places.location',
        'places.types'
      ].join(',');

      // Prepare request body with location bias for radius support
      const requestBody: any = {
        textQuery: query,
        pageSize: 20, // Max results per page
      };

      // Add location bias if we have city coordinates
      // Note: In production, you'd want to geocode the city first or use pre-stored coordinates
      // For now, we rely on text search with city name, which implicitly biases results
      // TODO: Add city geocoding to apply explicit locationBias with radiusMeters

      // Use retry logic for resilience
      const keywordResults = await retryWithBackoff(async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': PLACES_API_KEY!,
            'X-Goog-FieldMask': fieldMask,
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (response.status === 429) {
          const error: any = new Error('Places API quota exceeded');
          error.code = '429';
          throw error;
        }

        if (!response.ok) {
          throw new Error(`Places API error: ${data.error?.message || response.statusText}`);
        }

        return data.places || [];
      }, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffFactor: 2,
      });

      if (Array.isArray(keywordResults)) {
        results.push(...keywordResults);
      }
    } catch (error: any) {
      // Isolate error to this keyword - don't fail entire batch
      const errorMsg = `Failed to search "${keyword}": ${error.message}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      // Continue with next keyword
    }
  }

  // If all keywords failed, throw error
  if (errors.length === params.keywords.length) {
    throw new Error(`All keyword searches failed: ${errors.join('; ')}`);
  }

  return results;
}

/**
 * Normalize a place result to CRM_Leads schema
 */
export function normalizePlaceToLead(
  place: PlacesResult,
  source: string,
  keyword: string,
  city: string,
  country: string
): {
  Name: string;
  Phone: string;
  Website: string;
  Address: string;
  Lat: number | undefined;
  Lng: number | undefined;
  City: string;
  CountryCode: string;
  Source: string;
  Keyword: string;
  Category: string;
  Status: string;
} {
  // Extract category from types
  const category = place.types?.find(t => 
    ['hair_care', 'beauty_salon', 'spa', 'barber_shop'].includes(t)
  ) || place.types?.[0] || 'unknown';

  // Extract domain from website
  let website = place.websiteUri || '';
  
  return {
    Name: place.displayName?.text || '',
    Phone: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
    Website: website,
    Address: place.formattedAddress || '',
    Lat: place.location?.latitude,
    Lng: place.location?.longitude,
    City: city,
    CountryCode: country,
    Source: source,
    Keyword: keyword,
    Category: category,
    Status: 'NEW',
  };
}

/**
 * Normalize phone number to E.164 format (best effort)
 * Uses ISO 3166-1 alpha-2 country codes
 */
export function normalizePhone(phone: string, countryCode?: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // If already has +, return as is
  if (normalized.startsWith('+')) {
    return normalized;
  }
  
  // Add country code prefix if available (ISO 3166-1 alpha-2)
  if (countryCode) {
    const countryPrefixes: Record<string, string> = {
      // Western Europe
      'DE': '+49',  // Germany
      'AT': '+43',  // Austria
      'CH': '+41',  // Switzerland
      'FR': '+33',  // France
      'IT': '+39',  // Italy
      'ES': '+34',  // Spain
      'GB': '+44',  // United Kingdom (ISO code, not UK)
      'NL': '+31',  // Netherlands
      'BE': '+32',  // Belgium
      'PT': '+351', // Portugal
      'GR': '+30',  // Greece
      'IE': '+353', // Ireland
      // Eastern Europe
      'PL': '+48',  // Poland
      'CZ': '+420', // Czech Republic
      'HU': '+36',  // Hungary
      'RO': '+40',  // Romania
      // Nordic
      'SE': '+46',  // Sweden
      'NO': '+47',  // Norway
      'DK': '+45',  // Denmark
      'FI': '+358', // Finland
      // Americas
      'US': '+1',   // United States
      'CA': '+1',   // Canada
      'MX': '+52',  // Mexico
      'BR': '+55',  // Brazil
      'AR': '+54',  // Argentina
      // Middle East
      'TR': '+90',  // Turkey
      'IL': '+972', // Israel
      'AE': '+971', // UAE
      'SA': '+966', // Saudi Arabia
      // Asia Pacific
      'CN': '+86',  // China
      'JP': '+81',  // Japan
      'KR': '+82',  // South Korea
      'IN': '+91',  // India
      'AU': '+61',  // Australia
      'NZ': '+64',  // New Zealand
    };
    
    const prefix = countryPrefixes[countryCode.toUpperCase()];
    if (prefix) {
      // Remove leading 0 if exists (common in European numbers)
      if (normalized.startsWith('0')) {
        normalized = normalized.substring(1);
      }
      return `${prefix}${normalized}`;
    }
  }
  
  return normalized;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Normalize a lead's fields (for cleanup endpoint)
 */
export function normalizeLeadFields(lead: any): {
  updated: boolean;
  normalized: Record<string, any>;
} {
  const normalized: Record<string, any> = {};
  let updated = false;

  // Skip rows with errors
  if (lead.Name?.includes('#ERROR!') || lead.Name?.includes('#N/A')) {
    return { updated: false, normalized: {} };
  }

  // Normalize phone
  if (lead.Phone) {
    const normalizedPhone = normalizePhone(lead.Phone, lead.CountryCode);
    if (normalizedPhone !== lead.Phone) {
      normalized.Phone = normalizedPhone;
      updated = true;
    }
  }

  // Extract domain from website
  if (lead.Website) {
    const domain = extractDomain(lead.Website);
    if (domain && domain !== lead.Website) {
      // Store domain separately if needed, or just normalize the URL
      normalized.Website = lead.Website.startsWith('http') ? lead.Website : `https://${lead.Website}`;
      updated = true;
    }
  }

  // Normalize city (title case)
  if (lead.City) {
    const normalizedCity = lead.City
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    if (normalizedCity !== lead.City) {
      normalized.City = normalizedCity;
      updated = true;
    }
  }

  // Trim all string fields
  const stringFields = ['Name', 'Address', 'Email', 'Notes', 'Owner'];
  for (const field of stringFields) {
    if (lead[field] && typeof lead[field] === 'string') {
      const trimmed = lead[field].trim();
      if (trimmed !== lead[field]) {
        normalized[field] = trimmed;
        updated = true;
      }
    }
  }

  return { updated, normalized };
}
