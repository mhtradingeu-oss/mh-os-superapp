import type { Express } from "express";
import express, { Router } from "express";
import { z } from "zod";
import * as orchestrator from "./lib/ai-orchestrator";

const router = Router();

router.get("/agents", async (req, res) => {
  try {
    const agents = await orchestrator.getRegisteredAgents();
    res.json(agents);
  } catch (error: any) {
    console.error('[AI API] GET /agents failed:', error);
    res.status(500).json({ 
      error: 'Failed to get registered agents', 
      details: error.message 
    });
  }
});

const submitTaskSchema = z.object({
  agentId: z.string(),
  task: z.string(),
  input: z.record(z.any()),
  requestedBy: z.string().optional()
});

router.post("/submit", async (req, res) => {
  try {
    const validated = submitTaskSchema.parse(req.body);
    
    // Route to new agent handlers for CORE_AGENTS
    if (validated.agentId.startsWith('A-PRC-')) {
      const { suggestPriceChanges } = await import('./lib/ai-agents/pricing-agent');
      const result = await suggestPriceChanges(
        (await import('./lib/sheets')).sheetsService,
        validated.input as any
      );
      return res.json(result);
    }
    
    if (validated.agentId.startsWith('A-OUT-')) {
      const { generateEmailTemplate } = await import('./lib/ai-agents/outreach-agent');
      const result = await generateEmailTemplate(
        (await import('./lib/sheets')).sheetsService,
        validated.input as any
      );
      return res.json(result);
    }
    
    if (validated.agentId.startsWith('A-SOC-')) {
      const { planCalendar } = await import('./lib/ai-agents/social-agent');
      const result = await planCalendar(
        (await import('./lib/sheets')).sheetsService,
        validated.input as any
      );
      return res.json(result);
    }
    
    if (validated.agentId.startsWith('A-SEO-')) {
      const { harvestKeywords } = await import('./lib/ai-agents/seo-agent');
      const result = await harvestKeywords(
        (await import('./lib/sheets')).sheetsService,
        validated.input as any
      );
      return res.json(result);
    }
    
    if (validated.agentId.startsWith('A-CRM-')) {
      const { harvestPlaces } = await import('./lib/ai-agents/crm-agent');
      const result = await harvestPlaces(
        (await import('./lib/sheets')).sheetsService,
        validated.input as any
      );
      return res.json(result);
    }
    
    if (validated.agentId.startsWith('A-ADS-')) {
      const { generateAdsCSV } = await import('./lib/ai-agents/ads-agent');
      const result = await generateAdsCSV(
        (await import('./lib/sheets')).sheetsService,
        validated.input as any
      );
      return res.json(result);
    }
    
    if (validated.agentId.startsWith('A-ECM-')) {
      const { auditCatalog } = await import('./lib/ai-agents/ecommerce-agent');
      const result = await auditCatalog(
        (await import('./lib/sheets')).sheetsService,
        validated.input as any
      );
      return res.json(result);
    }
    
    // Fall back to legacy orchestrator for other agents
    const result = await orchestrator.submitTask(validated);
    res.json(result);
  } catch (error: any) {
    console.error('[AI API] POST /submit failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to submit task', 
      details: error.message 
    });
  }
});

router.get("/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing jobId parameter' 
      });
    }
    
    const job = await orchestrator.getJobStatus(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Job not found', 
        jobId 
      });
    }
    
    res.json(job);
  } catch (error: any) {
    console.error('[AI API] GET /jobs/:jobId failed:', error);
    res.status(500).json({ 
      error: 'Failed to get job status', 
      details: error.message 
    });
  }
});

router.get("/approvals/pending", async (req, res) => {
  try {
    const pendingJobs = await orchestrator.getPendingApprovals();
    res.json(pendingJobs);
  } catch (error: any) {
    console.error('[AI API] GET /approvals/pending failed:', error);
    res.status(500).json({ 
      error: 'Failed to get pending approvals', 
      details: error.message 
    });
  }
});

const approveJobSchema = z.object({
  approvedBy: z.string(),
  notes: z.string().optional()
});

router.post("/approvals/:jobId/approve", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing jobId parameter' 
      });
    }
    
    const validated = approveJobSchema.parse(req.body);
    
    // Try new approval workflow first
    const { approveDraft } = await import('./lib/ai-approval-workflow');
    const { sheetsService } = await import('./sheets');
    
    try {
      // Get job to determine tables
      const jobs = await sheetsService.readSheet<any>('AI_Jobs');
      const job = jobs.find((j: any) => j.JobID === jobId);
      
      if (job) {
        // New system
        const { draftTable, productionTable } = getDraftProductionTables(job.AgentID, job.Task);
        await approveDraft(sheetsService, jobId, validated.approvedBy, draftTable, productionTable);
        return res.json({ success: true, jobId, status: 'APPROVED' });
      }
    } catch (error) {
      console.log('[AI API] New approval failed, trying legacy:', error);
    }
    
    // Fall back to legacy
    const result = await orchestrator.approveJob({
      jobId,
      approvedBy: validated.approvedBy,
      notes: validated.notes
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[AI API] POST /approvals/:jobId/approve failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to approve job', 
      details: error.message 
    });
  }
});

function getDraftProductionTables(agentId: string, task: string): { draftTable: string; productionTable: string } {
  if (agentId.startsWith('A-PRC-')) {
    return { draftTable: 'Pricing_Suggestions_Draft', productionTable: 'Pricing_Suggestions' };
  }
  if (agentId.startsWith('A-OUT-')) {
    return { draftTable: 'Outreach_Templates_Draft', productionTable: 'Outreach_Templates' };
  }
  if (agentId.startsWith('A-SOC-')) {
    return { draftTable: 'Social_Calendar_Draft', productionTable: 'Social_Calendar' };
  }
  if (agentId.startsWith('A-SEO-')) {
    return { draftTable: 'SEO_Keywords_Draft', productionTable: 'SEO_Keywords' };
  }
  if (agentId.startsWith('A-CRM-')) {
    return { draftTable: 'CRM_Leads_Draft', productionTable: 'CRM_Leads' };
  }
  if (agentId.startsWith('A-ADS-')) {
    return { draftTable: 'Ads_Campaigns_Draft', productionTable: 'Ads_Campaigns' };
  }
  if (agentId.startsWith('A-ECM-')) {
    return { draftTable: 'Catalog_Fixes_Draft', productionTable: 'Catalog_Fixes' };
  }
  return { draftTable: 'AI_Drafts', productionTable: 'AI_Production' };
}

// Sales Copilot endpoints
router.post("/suggest-lines", async (req, res) => {
  try {
    const { partnerId, currentLines, pricingData } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner ID is required' });
    }

    const { suggestQuoteLines } = await import('./lib/ai-agents/sales-copilot');
    const { sheetsService } = await import('./lib/sheets');
    
    const result = await suggestQuoteLines(sheetsService, {
      partnerId,
      currentLines: currentLines || [],
      pricingData
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[AI API] POST /suggest-lines failed:', error);
    res.status(500).json({ 
      error: 'Failed to generate suggestions', 
      details: error.message 
    });
  }
});

router.post("/reprice", async (req, res) => {
  try {
    const { partnerId, lines, pricingData } = req.body;
    
    if (!lines || lines.length === 0) {
      return res.status(400).json({ error: 'Quote lines are required' });
    }

    const { repriceQuoteLines } = await import('./lib/ai-agents/sales-copilot');
    const { sheetsService } = await import('./lib/sheets');
    
    const result = await repriceQuoteLines(sheetsService, {
      partnerId,
      lines,
      pricingData
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[AI API] POST /reprice failed:', error);
    res.status(500).json({ 
      error: 'Failed to reprice lines', 
      details: error.message 
    });
  }
});

router.post("/summarize-quote", async (req, res) => {
  try {
    const { partnerId, lines, pricingData } = req.body;
    
    if (!partnerId || !lines || lines.length === 0) {
      return res.status(400).json({ error: 'Partner ID and quote lines are required' });
    }

    const { summarizeQuote } = await import('./lib/ai-agents/sales-copilot');
    const { sheetsService } = await import('./lib/sheets');
    
    const result = await summarizeQuote(sheetsService, {
      partnerId,
      lines,
      pricingData
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[AI API] POST /summarize-quote failed:', error);
    res.status(500).json({ 
      error: 'Failed to summarize quote', 
      details: error.message 
    });
  }
});

const rejectJobSchema = z.object({
  rejectedBy: z.string(),
  reason: z.string()
});

router.post("/approvals/:jobId/reject", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing jobId parameter' 
      });
    }
    
    const validated = rejectJobSchema.parse(req.body);
    
    const result = await orchestrator.rejectJob({
      jobId,
      rejectedBy: validated.rejectedBy,
      reason: validated.reason
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[AI API] POST /approvals/:jobId/reject failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to reject job', 
      details: error.message 
    });
  }
});

export function registerAIRoutes(app: Express) {
  app.use("/api/ai", router);
}
