import { GoogleSheetsService } from './sheets.js';
import { normalizePhone, extractDomain } from './places.js';

/**
 * Deduplication utilities for CRM_Leads
 */

export interface DedupeKey {
  type: 'phone' | 'email' | 'domain' | 'name_city';
  value: string;
}

/**
 * Generate dedupe keys for a lead
 */
export function generateDedupeKeys(lead: {
  Name?: string;
  Phone?: string;
  Email?: string;
  Website?: string;
  City?: string;
  CountryCode?: string;
}): DedupeKey[] {
  const keys: DedupeKey[] = [];

  // Phone key
  if (lead.Phone) {
    const normalizedPhone = normalizePhone(lead.Phone, lead.CountryCode);
    if (normalizedPhone) {
      keys.push({
        type: 'phone',
        value: normalizedPhone.toLowerCase(),
      });
    }
  }

  // Email key
  if (lead.Email) {
    const normalizedEmail = lead.Email.toLowerCase().trim();
    if (normalizedEmail) {
      keys.push({
        type: 'email',
        value: normalizedEmail,
      });
    }
  }

  // Domain key
  if (lead.Website) {
    const domain = extractDomain(lead.Website);
    if (domain) {
      keys.push({
        type: 'domain',
        value: domain.toLowerCase(),
      });
    }
  }

  // Name+City key (fuzzy match prevention)
  if (lead.Name && lead.City) {
    const normalizedName = lead.Name.toLowerCase().trim().replace(/\s+/g, '_');
    const normalizedCity = lead.City.toLowerCase().trim().replace(/\s+/g, '_');
    keys.push({
      type: 'name_city',
      value: `${normalizedName}::${normalizedCity}`,
    });
  }

  return keys;
}

/**
 * Check if a lead is a duplicate based on existing dedupe index
 */
export async function checkDuplicate(
  sheetsService: GoogleSheetsService,
  dedupeKeys: DedupeKey[]
): Promise<{ isDuplicate: boolean; existingLeadID?: string; matchedKey?: string }> {
  if (dedupeKeys.length === 0) {
    return { isDuplicate: false };
  }

  try {
    const dedupeIndex = await sheetsService.readSheet<{
      IndexKey: string;
      LeadID: string;
      Type: string;
      Notes?: string;
    }>('Dedupe_Index');

    for (const key of dedupeKeys) {
      const indexKey = `${key.type}:${key.value}`;
      const existing = dedupeIndex.find(entry => entry.IndexKey === indexKey);

      if (existing) {
        return {
          isDuplicate: true,
          existingLeadID: existing.LeadID,
          matchedKey: indexKey,
        };
      }
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking duplicates:', error);
    // If dedupe check fails, assume not duplicate to avoid blocking
    return { isDuplicate: false };
  }
}

/**
 * Add dedupe index entries for a lead
 */
export async function addDedupeEntries(
  sheetsService: GoogleSheetsService,
  leadID: string,
  dedupeKeys: DedupeKey[]
): Promise<void> {
  if (dedupeKeys.length === 0) return;

  const entries = dedupeKeys.map(key => ({
    IndexKey: `${key.type}:${key.value}`,
    LeadID: leadID,
    Type: key.type,
    Notes: '',
  }));

  try {
    await sheetsService.writeRows('Dedupe_Index', entries);
  } catch (error) {
    console.error('Error adding dedupe entries:', error);
    throw error;
  }
}

/**
 * Remove dedupe index entries for a lead
 */
export async function removeDedupeEntries(
  sheetsService: GoogleSheetsService,
  leadID: string
): Promise<void> {
  try {
    const dedupeIndex = await sheetsService.readSheet('Dedupe_Index');
    const entriesToRemove = dedupeIndex.filter((entry: any) => entry.LeadID === leadID);

    // Note: Google Sheets doesn't have a simple "delete row" API
    // For now, we'll just log this. In production, you'd need to:
    // 1. Read all rows
    // 2. Filter out the ones to remove
    // 3. Clear the sheet
    // 4. Write back the filtered rows
    console.log(`Would remove ${entriesToRemove.length} dedupe entries for lead ${leadID}`);
  } catch (error) {
    console.error('Error removing dedupe entries:', error);
  }
}
