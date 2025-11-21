import { sheetsService } from "./sheets";
import { aiSheetsService } from "./ai-sheets-service";
import { nanoid } from "nanoid";
import type { AICrew, AIJob, AIAgent } from "@shared/schema";
import { CORE_AGENTS, getAgentById } from './ai-agent-registry';
import { runGuardrails } from './ai-guardrails';
import { 
  createDraftJob, 
  approveDraft as approveDraftWorkflow, 
  rejectDraft as rejectDraftWorkflow, 
  getPendingApprovals as getPendingApprovalsWorkflow,
  getJobWithDrafts
} from './ai-approval-workflow';

export interface AgentDefinition {
  agentId: string;
  name: string;
  description: string;
  tasks: string[];
  requiresApproval: boolean;
  guardrails: ('MAP' | 'GDPR')[];
  maxTokens: number;
  model: 'gpt-5' | 'gpt-4';
}

export const REGISTERED_AGENTS: AgentDefinition[] = [
  {
    agentId: 'A-PRICE-301',
    name: 'Pricing Analyst',
    description: 'Pricing strategy expert. Analyzes prices, suggests optimizations, validates MAP compliance.',
    tasks: ['suggest-pricing', 'analyze-pricing', 'validate-map'],
    requiresApproval: true,
    guardrails: ['MAP'],
    maxTokens: 2048,
    model: 'gpt-4'
  },
  {
    agentId: 'A-STAND-401',
    name: 'Stand Ops Bot',
    description: 'Stand operations specialist. Refill planning, stockout predictions, performance analysis.',
    tasks: ['plan-refill', 'predict-stockout', 'analyze-performance'],
    requiresApproval: true,
    guardrails: [],
    maxTokens: 2048,
    model: 'gpt-4'
  },
  {
    agentId: 'A-GROWTH-501',
    name: 'Growth Writer',
    description: 'B2B content creator. Generates email templates, marketing copy, social media posts.',
    tasks: ['suggest-template', 'draft-campaign', 'create-content'],
    requiresApproval: true,
    guardrails: ['GDPR'],
    maxTokens: 3072,
    model: 'gpt-4'
  },
  {
    agentId: 'A-OPS-601',
    name: 'Ops Assistant',
    description: 'Operations helper. Drafts emails, creates reports, answers operational questions.',
    tasks: ['draft-email', 'create-report', 'analyze-data'],
    requiresApproval: false,
    guardrails: [],
    maxTokens: 2048,
    model: 'gpt-4'
  },
  {
    agentId: 'A-OUT-010',
    name: 'Template Writer',
    description: 'Outreach template specialist. Creates GDPR-compliant email, SMS, and WhatsApp templates with tokenization.',
    tasks: ['suggest-template', 'draft-template', 'create-template'],
    requiresApproval: true,
    guardrails: ['GDPR'],
    maxTokens: 3072,
    model: 'gpt-4'
  },
  {
    agentId: 'A-OUT-020',
    name: 'Sequence Planner',
    description: 'Multi-step outreach sequence designer. Creates nurture sequences with optimal timing and follow-ups.',
    tasks: ['draft-sequence', 'create-sequence', 'plan-sequence'],
    requiresApproval: true,
    guardrails: ['GDPR'],
    maxTokens: 4096,
    model: 'gpt-4'
  },
  {
    agentId: 'A-OUT-101',
    name: 'Outreach Sequencer',
    description: 'B2B email outreach specialist. Generates templates, analyzes replies, drafts campaigns.',
    tasks: ['suggest-template', 'summarize-replies', 'draft-campaign'],
    requiresApproval: true,
    guardrails: ['GDPR'],
    maxTokens: 2048,
    model: 'gpt-5'
  },
  {
    agentId: 'A-SEO-201',
    name: 'Keyword Harvester',
    description: 'SEO keyword researcher. Generates keywords from seed terms.',
    tasks: ['harvest-keywords'],
    requiresApproval: false,
    guardrails: [],
    maxTokens: 4096,
    model: 'gpt-5'
  },
  {
    agentId: 'A-SEO-202',
    name: 'Cluster Architect',
    description: 'Semantic keyword clustering specialist.',
    tasks: ['cluster-keywords'],
    requiresApproval: false,
    guardrails: [],
    maxTokens: 4096,
    model: 'gpt-5'
  }
];

export interface SubmitTaskInput {
  agentId: string;
  task: string;
  input: Record<string, any>;
  requestedBy?: string;
}

export interface SubmitTaskResult {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'DRAFT' | 'ERROR';
  requiresApproval: boolean;
  message: string;
}

export async function submitTask(params: SubmitTaskInput): Promise<SubmitTaskResult> {
  const { agentId, task, input, requestedBy = 'system' } = params;

  const agent = REGISTERED_AGENTS.find(a => a.agentId === agentId);
  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  if (!agent.tasks.includes(task)) {
    throw new Error(`Agent ${agentId} does not support task: ${task}`);
  }

  const jobId = `AI-${nanoid(10)}`;
  const timestamp = new Date().toISOString();

  const job: Partial<AICrew> = {
    JobID: jobId,
    CreatedTS: timestamp,
    AgentID: agentId,
    Task: task,
    InputJSON: JSON.stringify(input),
    OutputJSON: '',
    Status: 'PENDING',
    GuardrailsPassed: undefined,
    RequiresApproval: agent.requiresApproval,
    ApprovedBy: '',
    ApprovedTS: '',
    AppliedTS: '',
    ErrorMsg: '',
    Notes: `Submitted by ${requestedBy} at ${timestamp}`
  };

  try {
    await aiSheetsService.writeRows('AI_Crew', [job]);
    
    await sheetsService.writeOSHealth(
      'AI Orchestrator',
      'PASS',
      `Task submitted: ${agentId} - ${task}`,
      { jobId, agentId, task }
    );

    let guardPassed = true;
    let guardError = '';

    if (agent.guardrails.includes('MAP')) {
      const mapResult = await validateMAP(task, input);
      if (!mapResult.passed) {
        guardPassed = false;
        guardError += `MAP violation: ${mapResult.message}. `;
      }
    }

    if (agent.guardrails.includes('GDPR')) {
      const gdprResult = await validateGDPR(task, input);
      if (!gdprResult.passed) {
        guardPassed = false;
        guardError += `GDPR violation: ${gdprResult.message}. `;
      }
    }

    if (!guardPassed) {
      await aiSheetsService.updateRow('AI_Crew', 'JobID', jobId, {
        Status: 'ERROR',
        GuardrailsPassed: false,
        ErrorMsg: guardError.trim(),
        Notes: `Guardrail checks failed: ${guardError.trim()}`
      });

      return {
        jobId,
        status: 'ERROR',
        requiresApproval: false,
        message: `Guardrail checks failed: ${guardError.trim()}`
      };
    }

    const finalStatus = agent.requiresApproval ? 'DRAFT' : 'PENDING';

    await aiSheetsService.updateRow('AI_Crew', 'JobID', jobId, {
      Status: finalStatus,
      GuardrailsPassed: true
    });

    return {
      jobId,
      status: finalStatus,
      requiresApproval: agent.requiresApproval,
      message: agent.requiresApproval
        ? `Task submitted for approval. Job ID: ${jobId}`
        : `Task submitted successfully. Job ID: ${jobId}`
    };
  } catch (error: any) {
    console.error('[Orchestrator] submitTask failed:', error);
    
    await sheetsService.writeOSHealth(
      'AI Orchestrator',
      'FAIL',
      `Task submission failed: ${error.message}`,
      { agentId, task }
    );

    throw new Error(`Failed to submit task: ${error.message}`);
  }
}

export async function getJobStatus(jobId: string): Promise<AICrew | null> {
  try {
    const jobs = await sheetsService.readSheet<AICrew>('AI_Crew');
    const job = jobs.find(j => j.JobID === jobId);
    
    return job || null;
  } catch (error: any) {
    console.error('[Orchestrator] getJobStatus failed:', error);
    throw new Error(`Failed to get job status: ${error.message}`);
  }
}

export async function getPendingApprovals(): Promise<(AICrew | AIJob)[]> {
  try {
    // Get from new AI_Jobs table (if it exists)
    let newJobs: AIJob[] = [];
    try {
      newJobs = await getPendingApprovalsWorkflow(sheetsService);
    } catch (error) {
      // AI_Jobs table may not exist yet, that's OK
      console.log('[Orchestrator] AI_Jobs table not yet available');
    }
    
    // Get from legacy AI_Crew table
    const jobs = await sheetsService.readSheet<AICrew>('AI_Crew');
    const pendingLegacy = jobs.filter(j => 
      j.Status === 'DRAFT' && 
      j.RequiresApproval === true &&
      (!j.ApprovedBy || j.ApprovedBy === '')
    );
    
    return [...newJobs, ...pendingLegacy];
  } catch (error: any) {
    console.error('[Orchestrator] getPendingApprovals failed:', error);
    throw new Error(`Failed to get pending approvals: ${error.message}`);
  }
}

export interface ApprovalInput {
  jobId: string;
  approvedBy: string;
  notes?: string;
}

export async function approveJob(params: ApprovalInput): Promise<{ success: boolean; applied: boolean }> {
  const { jobId, approvedBy, notes } = params;

  try {
    const job = await getJobStatus(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.Status !== 'DRAFT') {
      throw new Error(`Job ${jobId} is not in DRAFT status (current: ${job.Status})`);
    }

    const timestamp = new Date().toISOString();

    await aiSheetsService.updateRow('AI_Crew', 'JobID', jobId, {
      Status: 'APPROVED',
      ApprovedBy: approvedBy,
      ApprovedTS: timestamp,
      Notes: notes || `Approved by ${approvedBy} at ${timestamp}`
    });

    let applied = false;

    try {
      await applyApprovedJob(job, approvedBy);
      applied = true;
      
      await aiSheetsService.updateRow('AI_Crew', 'JobID', jobId, {
        AppliedTS: timestamp
      });
    } catch (applyError: any) {
      console.error('[Orchestrator] Apply failed:', applyError);
      
      await aiSheetsService.updateRow('AI_Crew', 'JobID', jobId, {
        ErrorMsg: `Apply failed: ${applyError.message}`,
        Notes: `Approved but apply failed: ${applyError.message}`
      });
    }

    await sheetsService.writeOSHealth(
      'AI Orchestrator',
      'PASS',
      `Job approved: ${jobId} by ${approvedBy}${applied ? ' (applied)' : ' (apply failed)'}`,
      { jobId, approvedBy, applied }
    );

    return {
      success: true,
      applied
    };
  } catch (error: any) {
    console.error('[Orchestrator] approveJob failed:', error);
    
    await sheetsService.writeOSHealth(
      'AI Orchestrator',
      'FAIL',
      `Job approval failed: ${error.message}`,
      { jobId }
    );

    throw new Error(`Failed to approve job: ${error.message}`);
  }
}

async function applyApprovedJob(job: AICrew, approvedBy: string): Promise<void> {
  if (!job.OutputJSON || job.OutputJSON === '') {
    throw new Error('No output to apply - OutputJSON is empty');
  }

  let output: any;
  try {
    output = JSON.parse(job.OutputJSON);
  } catch (error) {
    throw new Error(`Invalid OutputJSON: ${error}`);
  }

  const task = job.Task;
  const timestamp = new Date().toISOString();

  switch (task) {
    case 'suggest-template': {
      if (!output.templateId || !output.name || !output.subject || !output.body) {
        throw new Error('Invalid template output - missing required fields');
      }

      await sheetsService.writeRows('Outreach_Templates', [{
        TemplateID: output.templateId,
        Name: output.name,
        Subject: output.subject,
        Body: output.body,
        Locale: output.locale || 'en',
        CreatedTS: timestamp,
        Notes: `AI-generated via ${job.JobID}, approved by ${approvedBy}`
      }]);

      await sheetsService.writeOSHealth(
        'AI Orchestrator Apply',
        'PASS',
        `Applied template: ${output.name}`,
        { jobId: job.JobID, templateId: output.templateId }
      );
      break;
    }

    case 'draft-campaign': {
      if (!output.campaignId || !output.name) {
        throw new Error('Invalid campaign output - missing required fields');
      }

      await sheetsService.writeRows('Outreach_Campaigns', [{
        CampaignID: output.campaignId,
        Name: output.name,
        Status: 'draft',
        TemplateID: output.templateId || '',
        CreatedTS: timestamp,
        Notes: `AI-generated via ${job.JobID}, approved by ${approvedBy}`
      }]);

      await sheetsService.writeOSHealth(
        'AI Orchestrator Apply',
        'PASS',
        `Applied campaign: ${output.name}`,
        { jobId: job.JobID, campaignId: output.campaignId }
      );
      break;
    }

    case 'draft-sequence':
    case 'create-sequence':
    case 'plan-sequence': {
      if (!output.sequenceId || !output.name || !output.steps) {
        throw new Error('Invalid sequence output - missing required fields');
      }

      await sheetsService.writeRows('Outreach_Sequences', [{
        SeqID: output.sequenceId,
        Name: output.name,
        Purpose: output.purpose || '',
        StepsJSON: JSON.stringify(output.steps),
        Lang: output.lang || 'EN',
        Tier: output.tier || '',
        WarmupFlag: output.warmupFlag || false,
        Owner: approvedBy,
        Status: 'draft',
        CreatedTS: timestamp,
        Notes: `AI-generated via ${job.JobID}, approved by ${approvedBy}`
      }]);

      await sheetsService.writeOSHealth(
        'AI Orchestrator Apply',
        'PASS',
        `Applied sequence: ${output.name} (${output.steps.length} steps)`,
        { jobId: job.JobID, sequenceId: output.sequenceId, steps: output.steps.length }
      );
      break;
    }

    case 'suggest-pricing': {
      if (!output.sku || output.price === undefined) {
        throw new Error('Invalid pricing output - missing SKU or price');
      }

      await sheetsService.updateRow('Final_Price_List', 'SKU', output.sku, {
        UVP: output.price,
        Notes: `AI-suggested price via ${job.JobID}, approved by ${approvedBy} at ${timestamp}`
      });

      await sheetsService.writeOSHealth(
        'AI Orchestrator Apply',
        'PASS',
        `Applied pricing: ${output.sku} = €${output.price}`,
        { jobId: job.JobID, sku: output.sku, price: output.price }
      );
      break;
    }

    case 'harvest-keywords':
    case 'cluster-keywords':
    case 'summarize-replies': {
      console.log(`[Orchestrator] Task ${task} has no apply action - output stored in OutputJSON only`);
      await sheetsService.writeOSHealth(
        'AI Orchestrator Apply',
        'PASS',
        `No apply action for task: ${task} (output in OutputJSON)`,
        { jobId: job.JobID, task }
      );
      break;
    }

    default:
      throw new Error(`Unknown task type: ${task} - no apply handler defined`);
  }
}

export interface RejectionInput {
  jobId: string;
  rejectedBy: string;
  reason: string;
}

export async function rejectJob(params: RejectionInput): Promise<{ success: boolean }> {
  const { jobId, rejectedBy, reason } = params;

  try {
    const job = await getJobStatus(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.Status !== 'DRAFT') {
      throw new Error(`Job ${jobId} is not in DRAFT status (current: ${job.Status})`);
    }

    const timestamp = new Date().toISOString();

    await aiSheetsService.updateRow('AI_Crew', 'JobID', jobId, {
      Status: 'REJECTED',
      RejectedBy: rejectedBy,
      RejectedTS: timestamp,
      Notes: `Rejected by ${rejectedBy} at ${timestamp}: ${reason}`
    });

    await sheetsService.writeOSHealth(
      'AI Orchestrator',
      'PASS',
      `Job rejected: ${jobId} by ${rejectedBy}`,
      { jobId, rejectedBy, reason }
    );

    return {
      success: true
    };
  } catch (error: any) {
    console.error('[Orchestrator] rejectJob failed:', error);
    
    await sheetsService.writeOSHealth(
      'AI Orchestrator',
      'FAIL',
      `Job rejection failed: ${error.message}`,
      { jobId }
    );

    throw new Error(`Failed to reject job: ${error.message}`);
  }
}

interface GuardrailResult {
  passed: boolean;
  message: string;
}

async function validateMAP(task: string, input: Record<string, any>): Promise<GuardrailResult> {
  const pricingTasks = ['suggest-pricing', 'auto-reprice', 'adjust-map'];
  
  if (!pricingTasks.includes(task)) {
    return { passed: true, message: 'Not a pricing task' };
  }

  const { sku, proposedPrice, priceType } = input;
  
  if (!sku || proposedPrice === undefined) {
    return {
      passed: false,
      message: 'Missing required fields: sku, proposedPrice'
    };
  }

  const proposedPriceNum = Number(proposedPrice);
  if (isNaN(proposedPriceNum)) {
    return {
      passed: false,
      message: `Invalid proposedPrice: ${proposedPrice} is not a valid number`
    };
  }

  try {
    const products = await sheetsService.getFinalPriceList();
    const product = products.find(p => p.SKU === sku);
    
    if (!product) {
      return {
        passed: false,
        message: `Product ${sku} not found`
      };
    }

    const mapNum = Number(product.MAP);
    if (!Number.isFinite(mapNum) || mapNum <= 0) {
      return {
        passed: false,
        message: `Product ${sku} has invalid or missing MAP (value: ${product.MAP})`
      };
    }

    const landedCostNum = Number(product.COGS_EUR);
    if (!Number.isFinite(landedCostNum)) {
      return {
        passed: false,
        message: `Product ${sku} has invalid landed cost (value: ${product.COGS_EUR})`
      };
    }
    
    if (proposedPriceNum < mapNum) {
      await sheetsService.writeRows('MAP_Guardrails', [{
        Timestamp: new Date().toISOString(),
        SKU: sku,
        ProposedPrice: proposedPriceNum,
        MAP: mapNum,
        Violation: `Proposed ${priceType || 'price'} ${proposedPriceNum.toFixed(2)} below MAP ${mapNum.toFixed(2)}`,
        Task: task
      }]);
      
      return {
        passed: false,
        message: `Proposed ${priceType || 'price'} €${proposedPriceNum.toFixed(2)} violates MAP €${mapNum.toFixed(2)}`
      };
    }

    if (landedCostNum > 0 && proposedPriceNum < landedCostNum * 1.05) {
      return {
        passed: false,
        message: `Proposed price €${proposedPriceNum.toFixed(2)} too close to landed cost €${landedCostNum.toFixed(2)}`
      };
    }

    return {
      passed: true,
      message: `Pricing valid: €${proposedPriceNum.toFixed(2)} >= MAP €${mapNum.toFixed(2)}`
    };
  } catch (error: any) {
    console.error('[Guardrail] MAP validation failed:', error);
    return {
      passed: false,
      message: `MAP validation error: ${error.message}`
    };
  }
}

async function validateGDPR(task: string, input: Record<string, any>): Promise<GuardrailResult> {
  const outreachTasks = ['suggest-template', 'draft-template', 'create-template', 'draft-campaign', 'draft-sequence', 'create-sequence', 'plan-sequence', 'send-email'];
  
  if (!outreachTasks.includes(task)) {
    return { passed: true, message: 'Not an outreach task' };
  }

  const sequenceTasks = ['draft-sequence', 'create-sequence', 'plan-sequence'];
  if (sequenceTasks.includes(task)) {
    return { passed: true, message: 'Sequence planning task - no content to validate' };
  }

  const { template, subject, body, content } = input;
  const emailContent = template || body || content || '';
  const emailSubject = subject || '';
  
  if (!emailContent && !emailSubject) {
    return {
      passed: false,
      message: 'Missing email content/template for GDPR validation'
    };
  }

  const violations: string[] = [];
  const contentLower = emailContent.toLowerCase();
  const subjectLower = emailSubject.toLowerCase();
  
  const unsubscribePatterns = [
    'unsubscribe',
    'opt-out',
    'opt out',
    'preferences',
    'manage subscription'
  ];
  
  const hasUnsubscribe = unsubscribePatterns.some(pattern => 
    contentLower.includes(pattern)
  );
  
  if (!hasUnsubscribe) {
    violations.push('Missing unsubscribe/opt-out mechanism');
  }

  const pressureTactics = [
    'act now',
    'limited time',
    'urgent',
    'expires soon',
    'last chance',
    'don\'t miss out',
    'only today',
    'hurry up'
  ];
  
  const hasPressure = pressureTactics.some(tactic => 
    contentLower.includes(tactic) || subjectLower.includes(tactic)
  );
  
  if (hasPressure) {
    violations.push('Contains pressure tactics (urgency manipulation)');
  }

  const falsePromises = [
    'guaranteed',
    'risk-free',
    'instant results',
    'make money fast',
    '100% success',
    'no effort required'
  ];
  
  const hasFalsePromises = falsePromises.some(promise => 
    contentLower.includes(promise) || subjectLower.includes(promise)
  );
  
  if (hasFalsePromises) {
    violations.push('Contains potentially false promises');
  }

  const transparencyPatterns = [
    'privacy policy',
    'data protection',
    'gdpr',
    'personal data',
    'information we collect'
  ];
  
  const hasTransparency = transparencyPatterns.some(pattern => 
    contentLower.includes(pattern)
  );

  if (violations.length > 0) {
    return {
      passed: false,
      message: `GDPR violations: ${violations.join(', ')}`
    };
  }

  return {
    passed: true,
    message: 'Email template compliant with GDPR requirements'
  };
}

const AI_WRITABLE_SHEETS = [
  'AI_Crew',
  'AI_Outbox',
  'MAP_Guardrails',
  'OS_Health',
  'SEO_Keywords',
  'SEO_Clusters'
];

export function validateWriteTarget(sheetName: string): { allowed: boolean; message: string } {
  if (AI_WRITABLE_SHEETS.includes(sheetName)) {
    return {
      allowed: true,
      message: `Write to ${sheetName} allowed (draft/audit sheet)`
    };
  }

  if (sheetName.startsWith('AI_') || sheetName.endsWith('_Draft')) {
    return {
      allowed: true,
      message: `Write to ${sheetName} allowed (draft/AI sheet pattern)`
    };
  }

  return {
    allowed: false,
    message: `Write to ${sheetName} blocked (production sheet - requires human approval)`
  };
}

export async function getRegisteredAgents(): Promise<(AgentDefinition | AIAgent)[]> {
  // Merge legacy agents with new agent registry
  return [...REGISTERED_AGENTS, ...CORE_AGENTS];
}
