/**
 * MH TRADING OS — Affiliate System Constants
 * ------------------------------------------
 * Centralized constants for the affiliate system to ensure consistency
 * across cache policies, repository methods, and sheet management.
 */

/**
 * Canonical affiliate sheet names (6 sheets)
 * These sheets have cache disabled for always-fresh reads
 */
export const AFFILIATE_SHEETS = [
  'AffiliateProfiles',
  'AffiliateClicks',
  'AffiliateConversions',
  'AffiliateCandidates',
  'AffiliateTasks',
  'AffiliateDiscoveryLog'
] as const;

/**
 * Stable object map for affiliate sheet names
 * Using object instead of array destructuring prevents position-dependent bugs
 */
export const AFFILIATE_SHEET_NAMES = {
  PROFILES: 'AffiliateProfiles' as const,
  CLICKS: 'AffiliateClicks' as const,
  CONVERSIONS: 'AffiliateConversions' as const,
  CANDIDATES: 'AffiliateCandidates' as const,
  TASKS: 'AffiliateTasks' as const,
  DISCOVERY_LOG: 'AffiliateDiscoveryLog' as const,
};

/**
 * Type helper for affiliate sheet names
 */
export type AffiliateSheetName = typeof AFFILIATE_SHEETS[number];

/**
 * Check if a sheet name is an affiliate sheet
 */
export function isAffiliateSheet(sheetName: string): sheetName is AffiliateSheetName {
  return AFFILIATE_SHEETS.includes(sheetName as AffiliateSheetName);
}
