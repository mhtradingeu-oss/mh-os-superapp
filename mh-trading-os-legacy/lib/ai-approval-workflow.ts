/**
 * AI Approval Workflow
 * 
 * Manages the draft → approval → production pipeline
 * Agents write to *_Draft tables, humans approve, system applies to production
 */

import { nanoid } from 'nanoid';
import type { GoogleSheetsService } from './sheets';
import type { AIJob } from '@shared/schema';

export interface ApprovalRequest {
  jobId: string;
  agentId: string;
  task: string;
  draftTable: string;
  productionTable: string;
  changes: Record<string, any>[];
  summary: string;
}

/**
 * Create a new job in AI_Jobs with DRAFT status
 */
export async function createDraftJob(
  sheetsService: GoogleSheetsService,
  agentId: string,
  task: string,
  inputJSON: string,
  outputJSON: string,
  guardrailsPassed: boolean,
  requiresApproval: boolean = true
): Promise<string> {
  const jobId = `JOB-${nanoid(10)}`;
  const now = new Date().toISOString();

  const job: Partial<AIJob> = {
    JobID: jobId,
    AgentID: agentId,
    Task: task,
    CreatedTS: now,
    InputJSON: inputJSON,
    OutputJSON: outputJSON,
    Status: 'DRAFT',
    GuardrailsPassed: guardrailsPassed,
    RequiresApproval: requiresApproval,
    RequestedBy: 'system',
  };

  await sheetsService.writeRows('AI_Jobs', [job]);
  await sheetsService.logToSheet('INFO', 'AI-Jobs', `Created draft job ${jobId} for ${agentId}/${task}`);

  return jobId;
}

/**
 * Approve a draft job and apply changes to production
 */
export async function approveDraft(
  sheetsService: GoogleSheetsService,
  jobId: string,
  approvedBy: string,
  draftTable: string,
  productionTable: string,
  matchColumn: string = 'JobID'
): Promise<void> {
  const now = new Date().toISOString();

  try {
    // 1. Get all draft rows for this job
    const draftRows = await sheetsService.readSheet<any>(draftTable);
    const jobDrafts = draftRows.filter(row => row[matchColumn] === jobId);

    if (jobDrafts.length === 0) {
      throw new Error(`No draft rows found for job ${jobId} in ${draftTable}`);
    }

    // 2. Apply to production (remove JobID field)
    const productionRows = jobDrafts.map(draft => {
      const { JobID, ...productionData } = draft;
      return productionData;
    });

    await sheetsService.writeRows(productionTable, productionRows);

    // 3. Update job status
    await sheetsService.updateRow('AI_Jobs', 'JobID', jobId, {
      Status: 'APPROVED',
      ApprovedBy: approvedBy,
      ApprovedTS: now,
      AppliedTS: now,
    });

    // 4. Clean up draft rows (optional - could keep for audit trail)
    // For now, we'll keep them for transparency

    await sheetsService.logToSheet(
      'INFO',
      'AI-Approval',
      `Approved job ${jobId}: Applied ${productionRows.length} rows to ${productionTable}`
    );
  } catch (error: any) {
    await sheetsService.updateRow('AI_Jobs', 'JobID', jobId, {
      Status: 'ERROR',
      ErrorMsg: `Approval failed: ${error.message}`,
    });
    throw error;
  }
}

/**
 * Reject a draft job
 */
export async function rejectDraft(
  sheetsService: GoogleSheetsService,
  jobId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();

  await sheetsService.updateRow('AI_Jobs', 'JobID', jobId, {
    Status: 'REJECTED',
    RejectedBy: rejectedBy,
    RejectedTS: now,
    Notes: reason,
  });

  await sheetsService.logToSheet(
    'INFO',
    'AI-Approval',
    `Rejected job ${jobId}: ${reason}`
  );
}

/**
 * Get all pending approval jobs
 */
export async function getPendingApprovals(
  sheetsService: GoogleSheetsService
): Promise<AIJob[]> {
  const jobs = await sheetsService.readSheet<AIJob>('AI_Jobs');
  return jobs.filter(job => job.Status === 'DRAFT' && job.RequiresApproval);
}

/**
 * Get job details with draft preview
 */
export async function getJobWithDrafts(
  sheetsService: GoogleSheetsService,
  jobId: string,
  draftTable: string
): Promise<{ job: AIJob; drafts: any[] }> {
  const jobs = await sheetsService.readSheet<AIJob>('AI_Jobs');
  const job = jobs.find(j => j.JobID === jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const allDrafts = await sheetsService.readSheet<any>(draftTable);
  const drafts = allDrafts.filter(d => d.JobID === jobId);

  return { job, drafts };
}

/**
 * Batch approve multiple jobs
 */
export async function batchApprove(
  sheetsService: GoogleSheetsService,
  jobIds: string[],
  approvedBy: string
): Promise<{ succeeded: string[]; failed: { jobId: string; error: string }[] }> {
  const succeeded: string[] = [];
  const failed: { jobId: string; error: string }[] = [];

  for (const jobId of jobIds) {
    try {
      // Get job to determine draft/production tables
      const jobs = await sheetsService.readSheet<AIJob>('AI_Jobs');
      const job = jobs.find(j => j.JobID === jobId);

      if (!job) {
        failed.push({ jobId, error: 'Job not found' });
        continue;
      }

      // Determine tables based on agent task
      const { draftTable, productionTable } = getDraftProductionTables(job.AgentID, job.Task);

      await approveDraft(sheetsService, jobId, approvedBy, draftTable, productionTable);
      succeeded.push(jobId);
    } catch (error: any) {
      failed.push({ jobId, error: error.message });
    }
  }

  return { succeeded, failed };
}

/**
 * Helper: Map agent task to draft/production table names
 */
function getDraftProductionTables(
  agentId: string,
  task: string
): { draftTable: string; productionTable: string } {
  // Pricing Agent
  if (agentId.startsWith('A-PRC-')) {
    return {
      draftTable: 'Pricing_Suggestions_Draft',
      productionTable: 'Pricing_Suggestions'
    };
  }

  // Outreach Agent
  if (agentId.startsWith('A-OUT-')) {
    if (task.includes('template')) {
      return {
        draftTable: 'Outreach_Templates_Draft',
        productionTable: 'Outreach_Templates'
      };
    }
  }

  // Social Agent
  if (agentId.startsWith('A-SOC-')) {
    return {
      draftTable: 'Social_Calendar_Draft',
      productionTable: 'Social_Calendar'
    };
  }

  // SEO Agent
  if (agentId.startsWith('A-SEO-')) {
    return {
      draftTable: 'SEO_Keywords_Draft',
      productionTable: 'SEO_Keywords'
    };
  }

  // CRM Agent
  if (agentId.startsWith('A-CRM-')) {
    return {
      draftTable: 'CRM_Leads_Draft',
      productionTable: 'CRM_Leads'
    };
  }

  // Default fallback
  return {
    draftTable: 'AI_Drafts',
    productionTable: 'AI_Production'
  };
}
