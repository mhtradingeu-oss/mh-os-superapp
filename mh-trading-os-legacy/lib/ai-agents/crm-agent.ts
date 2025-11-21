/**
 * CRM Agent - A-CRM-104
 * Lead enrichment, territory assignment, and scoring
 */

import { nanoid } from 'nanoid';
import type { GoogleSheetsService } from '../sheets';
import { runGuardrails } from '../ai-guardrails';
import { createDraftJob } from '../ai-approval-workflow';

export interface CRMEnrichInput {
  city?: string; // Filter by city
  maxLeads?: number; // Max leads to enrich
  source?: string; // 'GMaps' | 'Website' | 'Manual'
}

/**
 * Task: harvest-places
 * Harvests salon leads from Google Places API (simplified demo)
 */
export async function harvestPlaces(
  sheetsService: GoogleSheetsService,
  input: CRMEnrichInput
): Promise<{ jobId: string; leads: number; guardrailsPassed: boolean }> {
  const now = new Date().toISOString();
  
  // 1. Get existing leads to avoid duplicates
  const existingLeads = await sheetsService.readSheet<any>('CRM_Leads');
  const existingEmails = new Set(existingLeads.map((l: any) => l.Email).filter(Boolean));
  
  // 2. Generate sample leads (in real version would call Google Places API)
  const cities = input.city ? [input.city] : ['Berlin', 'Hamburg', 'Munich'];
  const maxLeads = input.maxLeads || 50;
  const leads = [];
  
  for (let i = 0; i < maxLeads && leads.length < maxLeads; i++) {
    const city = cities[i % cities.length];
    const businessName = `Salon ${city} ${i + 1}`;
    const email = `contact${i}@salon-${city.toLowerCase()}.de`;
    
    if (existingEmails.has(email)) continue; // Skip duplicates
    
    leads.push({
      LeadID: `LEAD-${nanoid(8)}`,
      JobID: '', // Will be set below
      BusinessName: businessName,
      Email: email,
      Phone: `+49 30 ${Math.floor(Math.random() * 9000000) + 1000000}`,
      City: city,
      Country: 'DE',
      Source: input.source || 'GMaps',
      QualityScore: Math.floor(Math.random() * 40) + 60, // 60-100
      Tags: `salon,${city.toLowerCase()},germany`,
      ConsentStatus: 'PENDING',
      Status: 'new',
      CreatedTS: now,
    });
  }
  
  // 3. Run guardrails (GDPR compliance)
  const guardrailResult = await runGuardrails(
    'A-CRM-104',
    'harvest-places',
    {
      emails: leads.map(l => ({
        recipientEmail: l.Email,
        hasUnsubscribe: false, // New leads don't have consent yet
      })),
    },
    sheetsService
  );
  
  // 4. Create draft job
  const jobId = await createDraftJob(
    sheetsService,
    'A-CRM-104',
    'harvest-places',
    JSON.stringify(input),
    JSON.stringify({ leads, guardrailResult }),
    guardrailResult.passed,
    true
  );
  
  // 5. Write to draft table
  const draftsWithJobId = leads.map(l => ({ ...l, JobID: jobId }));
  await sheetsService.writeRows('CRM_Leads_Draft', draftsWithJobId);
  
  await sheetsService.logToSheet(
    'INFO',
    'AI-CRM',
    `Harvested ${leads.length} new leads (Job: ${jobId}, Guardrails: ${guardrailResult.passed ? 'PASSED' : 'FAILED'})`
  );
  
  return {
    jobId,
    leads: leads.length,
    guardrailsPassed: guardrailResult.passed
  };
}
