/**
 * CRM Lead Scoring System
 * Calculates scores and tier hints based on lead data quality and location
 */

export interface ScoringRules {
  phonePoints: number;
  websitePoints: number;
  emailPoints: number;
  categoryKeywords: { keyword: string; points: number }[];
  priorityCities: { city: string; points: number }[];
  priorityPostalPrefixes: { prefix: string; points: number }[];
  tierThresholds: {
    high: number;
    medium: number;
  };
}

// Default scoring rules (can be overridden from Pricing_Params or Settings)
const DEFAULT_RULES: ScoringRules = {
  phonePoints: 10,
  websitePoints: 8,
  emailPoints: 6,
  categoryKeywords: [
    { keyword: 'barber', points: 5 },
    { keyword: 'friseur', points: 5 },
  ],
  priorityCities: [
    { city: 'Berlin', points: 3 },
    { city: 'Hamburg', points: 3 },
    { city: 'München', points: 3 },
    { city: 'Köln', points: 3 },
    { city: 'Frankfurt am Main', points: 3 },
  ],
  priorityPostalPrefixes: [
    { prefix: '10', points: 2 },
    { prefix: '12', points: 2 },
    { prefix: '20', points: 2 },
    { prefix: '80', points: 2 },
    { prefix: '50', points: 2 },
    { prefix: '60', points: 2 },
  ],
  tierThresholds: {
    high: 20,
    medium: 12,
  },
};

export interface LeadScoreResult {
  score: number;
  tierHint: 'High' | 'Med' | 'Low';
  breakdown: {
    phone: number;
    website: number;
    email: number;
    category: number;
    city: number;
    postal: number;
  };
}

export interface ScoringInput {
  Phone?: string;
  Website?: string;
  Email?: string;
  Category?: string;
  City?: string;
  Postal?: string;
}

/**
 * Calculate lead score based on data quality and location
 */
export function scoreLead(
  lead: ScoringInput,
  rules: ScoringRules = DEFAULT_RULES
): LeadScoreResult {
  const breakdown = {
    phone: 0,
    website: 0,
    email: 0,
    category: 0,
    city: 0,
    postal: 0,
  };

  // Phone (+10 by default)
  if (lead.Phone && lead.Phone.trim().length > 0) {
    breakdown.phone = rules.phonePoints;
  }

  // Website (+8 by default)
  if (lead.Website && lead.Website.trim().length > 0) {
    breakdown.website = rules.websitePoints;
  }

  // Email (+6 by default)
  if (lead.Email && lead.Email.trim().length > 0) {
    breakdown.email = rules.emailPoints;
  }

  // Category keywords (+5 for barber/friseur by default)
  if (lead.Category) {
    const categoryLower = lead.Category.toLowerCase();
    for (const { keyword, points } of rules.categoryKeywords) {
      if (categoryLower.includes(keyword.toLowerCase())) {
        breakdown.category = Math.max(breakdown.category, points);
      }
    }
  }

  // Priority cities (+3 by default)
  if (lead.City) {
    for (const { city, points } of rules.priorityCities) {
      if (lead.City.toLowerCase() === city.toLowerCase()) {
        breakdown.city = points;
        break;
      }
    }
  }

  // Postal prefix (+2 by default)
  if (lead.Postal) {
    for (const { prefix, points } of rules.priorityPostalPrefixes) {
      if (lead.Postal.startsWith(prefix)) {
        breakdown.postal = points;
        break;
      }
    }
  }

  // Calculate total score (max 30)
  const score = Math.min(
    30,
    breakdown.phone +
      breakdown.website +
      breakdown.email +
      breakdown.category +
      breakdown.city +
      breakdown.postal
  );

  // Determine tier hint
  let tierHint: 'High' | 'Med' | 'Low';
  if (score >= rules.tierThresholds.high) {
    tierHint = 'High';
  } else if (score >= rules.tierThresholds.medium) {
    tierHint = 'Med';
  } else {
    tierHint = 'Low';
  }

  return {
    score,
    tierHint,
    breakdown,
  };
}

/**
 * Get scoring rules from Pricing_Params or Settings (placeholder)
 * In the future, this can read from Google Sheets to make rules configurable
 */
export async function getScoringRules(): Promise<ScoringRules> {
  // TODO: Read from Pricing_Params or Settings sheet
  // For now, return default rules
  return DEFAULT_RULES;
}
