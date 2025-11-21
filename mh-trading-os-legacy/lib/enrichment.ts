/**
 * AI-Powered Lead Enrichment
 * 
 * Agent: A-GROW-100 "Growth Hunter"
 * Model: gpt-4o (AI_Default_Model)
 * 
 * Capabilities:
 * - Business size estimation (Solo/Small/Medium/Large)
 * - Category normalization (Barber_Shop/Salon/Cosmetics...)
 * - Working hours extraction (standardized format)
 * 
 * Safety:
 * - Only updates derived/descriptive fields in CRM_Leads
 * - No sensitive personal data collection
 * - All operations logged via Lead_Touches
 */

import type { CRMLead } from '@shared/schema';

export interface EnrichmentResult {
  CategoryNorm?: string;
  SizeHint?: 'Solo' | 'Small' | 'Medium' | 'Large';
  WorkingHours?: string;
  Notes?: string;
}

/**
 * Enrich a lead using AI
 * Returns derived/descriptive fields only
 */
export async function enrichLead(
  lead: CRMLead
): Promise<EnrichmentResult> {
  const { generateStructuredResponse } = await import('./openai');

  const systemPrompt = `You are A-GROW-100 "Growth Hunter", an AI assistant specialized in business data enrichment.

Your task is to analyze business information and provide:
1. CategoryNorm: Normalized category (e.g., Barber_Shop, Hair_Salon, Beauty_Salon, Cosmetics_Store, Spa, Wellness_Center, Nail_Salon, Other)
2. SizeHint: Business size estimation (Solo, Small, Medium, Large)
3. WorkingHours: Standardized working hours if determinable (e.g., "Mon-Fri 09:00-18:00, Sat 10:00-16:00")

Rules:
- Be conservative: if uncertain, leave fields empty or add to Notes
- No sensitive personal data
- Use only information provided`;

  const userPrompt = buildEnrichmentPrompt(lead);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const schema = `{
  "CategoryNorm": "string (optional)",
  "SizeHint": "Solo | Small | Medium | Large (optional)",
  "WorkingHours": "string (optional)",
  "Notes": "string (optional)"
}`;

  try {
    const result = await generateStructuredResponse<any>(fullPrompt, schema);
    return sanitizeEnrichmentResult(result);
  } catch (error) {
    console.error('Enrichment error:', error);
    throw error;
  }
}

/**
 * Build enrichment prompt from lead data
 */
function buildEnrichmentPrompt(lead: CRMLead): string {
  const parts: string[] = [];

  parts.push(`Business Name: ${lead.Name || 'Unknown'}`);

  if (lead.Category) {
    parts.push(`Category: ${lead.Category}`);
  }

  if (lead.Address) {
    parts.push(`Address: ${lead.Address}`);
  }

  if (lead.City) {
    parts.push(`City: ${lead.City}`);
  }

  if (lead.Phone) {
    parts.push(`Has phone contact: Yes`);
  }

  if (lead.Email) {
    parts.push(`Has email contact: Yes`);
  }

  if (lead.Website) {
    parts.push(`Has website: Yes`);
  }

  parts.push('\nAnalyze this business and provide enrichment data as JSON with fields: CategoryNorm, SizeHint, WorkingHours (optional), Notes (optional).');

  return parts.join('\n');
}

/**
 * Sanitize and validate enrichment result
 */
function sanitizeEnrichmentResult(raw: any): EnrichmentResult {
  const result: EnrichmentResult = {};

  // CategoryNorm
  if (raw.CategoryNorm && typeof raw.CategoryNorm === 'string') {
    const normalized = raw.CategoryNorm.trim();
    const validCategories = [
      'Barber_Shop', 'Hair_Salon', 'Beauty_Salon', 'Cosmetics_Store',
      'Spa', 'Wellness_Center', 'Nail_Salon', 'Other'
    ];
    if (validCategories.includes(normalized)) {
      result.CategoryNorm = normalized;
    }
  }

  // SizeHint
  if (raw.SizeHint && typeof raw.SizeHint === 'string') {
    const size = raw.SizeHint.trim() as any;
    if (['Solo', 'Small', 'Medium', 'Large'].includes(size)) {
      result.SizeHint = size;
    }
  }

  // WorkingHours
  if (raw.WorkingHours && typeof raw.WorkingHours === 'string') {
    result.WorkingHours = raw.WorkingHours.trim().substring(0, 200);
  }

  // Notes
  if (raw.Notes && typeof raw.Notes === 'string') {
    result.Notes = raw.Notes.trim().substring(0, 500);
  }

  return result;
}

/**
 * Determine if a lead should be enriched
 * Criteria: Score >= 12 AND missing Website OR Email
 */
export function shouldEnrich(lead: CRMLead): boolean {
  const hasMinScore = (lead.Score ?? 0) >= 12;
  const isMissingData = !lead.Website || !lead.Email;
  const notAlreadyEnriched = !lead.CategoryNorm && !lead.SizeHint;

  return hasMinScore && isMissingData && notAlreadyEnriched;
}
