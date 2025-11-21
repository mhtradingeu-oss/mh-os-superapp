import type { Express } from "express";
import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { outreachService } from "./lib/outreach-service";
import * as orchestrator from "./lib/ai-orchestrator";
import { createEmailProvider } from "./lib/email-providers";
import { sheetsService } from "./lib/sheets";
import { getWorkerInstance } from "./workers/outreach-worker";

const router = Router();

function verifyBrevoSignature(req: any): boolean {
  const signature = req.headers['x-brevo-signature'];
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  
  if (!secret || !signature) return false;
  
  const rawBody = req.rawBody ? Buffer.from(req.rawBody as any).toString('utf8') : JSON.stringify(req.body);
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch {
    return false;
  }
}

function verifyResendSignature(req: any): boolean {
  const signature = req.headers['svix-signature'] || req.headers['resend-signature'];
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  
  if (!secret || !signature) return false;
  
  const timestamp = req.headers['svix-timestamp'] || req.headers['resend-timestamp'];
  const rawBody = req.rawBody ? Buffer.from(req.rawBody as any).toString('utf8') : JSON.stringify(req.body);
  const payload = `${timestamp}.${rawBody}`;
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('base64');
  
  const signatures = signature.split(',').map((s: string) => s.trim());
  
  for (const sig of signatures) {
    const parts = sig.split('=');
    if (parts.length === 2 && parts[0].startsWith('v')) {
      const providedHash = parts[1];
      try {
        if (crypto.timingSafeEqual(
          Buffer.from(providedHash, 'base64'),
          Buffer.from(hash, 'base64')
        )) {
          return true;
        }
      } catch {
        continue;
      }
    }
  }
  
  return false;
}

router.get("/campaigns", async (req, res) => {
  try {
    const { status, owner } = req.query;
    
    const filters: any = {};
    if (status && typeof status === 'string') filters.status = status;
    if (owner && typeof owner === 'string') filters.owner = owner;
    
    const campaigns = await outreachService.getCampaigns(filters);
    res.json(campaigns);
  } catch (error: any) {
    console.error('[Outreach API] GET /campaigns failed:', error);
    res.status(500).json({ 
      error: 'Failed to get campaigns', 
      details: error.message 
    });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { day, campID } = req.query;
    
    const filters: any = {};
    if (day && typeof day === 'string') filters.day = day;
    if (campID && typeof campID === 'string') filters.campID = campID;
    
    const stats = await outreachService.getEmailStats(filters);
    res.json(stats);
  } catch (error: any) {
    console.error('[Outreach API] GET /stats failed:', error);
    res.status(500).json({ 
      error: 'Failed to get email stats', 
      details: error.message 
    });
  }
});

const draftTemplateSchema = z.object({
  purpose: z.string().min(1, "Purpose is required"),
  tone: z.enum(['formal', 'casual', 'friendly', 'professional']).optional(),
  lang: z.enum(['EN', 'AR', 'DE', 'en', 'ar', 'de']).optional(),
  channel: z.enum(['email', 'whatsapp', 'sms', 'linkedin']).optional(),
  targetAudience: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
  requestedBy: z.string().optional()
});

router.post("/templates/draft", async (req, res) => {
  try {
    const validated = draftTemplateSchema.parse(req.body);
    
    const result = await orchestrator.submitTask({
      agentId: "A-OUT-010",
      task: "suggest-template",
      input: {
        purpose: validated.purpose,
        tone: validated.tone || 'professional',
        lang: validated.lang || 'EN',
        channel: validated.channel || 'email',
        targetAudience: validated.targetAudience,
        keyPoints: validated.keyPoints
      },
      requestedBy: validated.requestedBy || "System"
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[Outreach API] POST /templates/draft failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to draft template', 
      details: error.message 
    });
  }
});

const draftSequenceSchema = z.object({
  purpose: z.string().min(1, "Purpose is required"),
  steps: z.number().min(1).max(10, "Sequences can have 1-10 steps"),
  lang: z.enum(['EN', 'AR', 'DE', 'en', 'ar', 'de']).optional(),
  tier: z.string().optional(),
  targetAudience: z.string().optional(),
  goalAction: z.string().optional(),
  requestedBy: z.string().optional()
});

router.post("/sequences/draft", async (req, res) => {
  try {
    const validated = draftSequenceSchema.parse(req.body);
    
    const result = await orchestrator.submitTask({
      agentId: "A-OUT-020",
      task: "draft-sequence",
      input: {
        purpose: validated.purpose,
        steps: validated.steps,
        lang: validated.lang || 'EN',
        tier: validated.tier,
        targetAudience: validated.targetAudience,
        goalAction: validated.goalAction
      },
      requestedBy: validated.requestedBy || "System"
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[Outreach API] POST /sequences/draft failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to draft sequence', 
      details: error.message 
    });
  }
});

const sendStepSchema = z.object({
  emailAddresses: z.array(z.string().email()).min(1, "At least one email address required"),
  stepIndex: z.number().min(0).optional(),
  testMode: z.boolean().optional()
});

router.post("/campaigns/:campID/send-step", async (req, res) => {
  try {
    const { campID } = req.params;
    
    if (!campID) {
      return res.status(400).json({ 
        error: 'Missing campID parameter' 
      });
    }
    
    const validated = sendStepSchema.parse(req.body);
    
    const campaign = await outreachService.getCampaignById(campID);
    
    if (!campaign) {
      return res.status(404).json({ 
        error: 'Campaign not found', 
        campID 
      });
    }
    
    const sequenceID = campaign.SequenceID || campaign.SeqID;
    if (!sequenceID) {
      return res.status(400).json({ 
        error: 'Campaign has no associated sequence' 
      });
    }
    
    const sequence = await outreachService.getSequenceById(sequenceID);
    if (!sequence) {
      return res.status(404).json({ 
        error: 'Sequence not found', 
        sequenceID 
      });
    }
    
    let steps: any[] = [];
    try {
      steps = JSON.parse(sequence.StepsJSON);
    } catch (e) {
      return res.status(400).json({ 
        error: 'Invalid sequence steps JSON' 
      });
    }
    
    const stepIndex = validated.stepIndex ?? 0;
    if (stepIndex < 0 || stepIndex >= steps.length) {
      return res.status(400).json({ 
        error: 'Invalid step index', 
        maxSteps: steps.length 
      });
    }
    
    const step = steps[stepIndex];
    const templateID = step.TemplateID || step.templateID;
    
    if (!templateID) {
      return res.status(400).json({ 
        error: 'Step has no templateID or TemplateID' 
      });
    }
    
    const template = await outreachService.getTemplateById(templateID);
    if (!template) {
      return res.status(404).json({ 
        error: 'Template not found', 
        templateID 
      });
    }
    
    const gdprResults = [];
    const sendResults = [];
    
    for (const email of validated.emailAddresses) {
      const gdprCheck = await outreachService.canContact(email, campID);
      
      if (!gdprCheck.allowed) {
        gdprResults.push({
          email,
          allowed: false,
          reason: gdprCheck.reason
        });
        continue;
      }
      
      const rateLimitCheck = await outreachService.checkRateLimit(email, 24);
      if (!rateLimitCheck) {
        gdprResults.push({
          email,
          allowed: false,
          reason: "Rate limit: Contact was sent an email within the last 24 hours"
        });
        continue;
      }
      
      gdprResults.push({
        email,
        allowed: true,
        reason: "All checks passed"
      });
      
      if (validated.testMode) {
        sendResults.push({
          email,
          status: "test_mode",
          message: "Email would be sent (test mode)"
        });
      } else {
        const msgID = `MSG-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const now = new Date().toISOString();
        
        const bodyWithTokens = template.Body || template.BodyMarkdown || "";
        
        await outreachService.createOutboxMessage({
          MsgID: msgID,
          CampID: campID,
          SeqStep: stepIndex,
          To: email,
          Subject: template.Subject,
          Body: bodyWithTokens,
          Template: templateID,
          Status: "queued",
          TS: now
        });
        
        await outreachService.recordContact(email, campID);
        
        sendResults.push({
          email,
          status: "queued",
          message: "Email queued for sending",
          msgID
        });
      }
    }
    
    res.json({
      campID,
      sequenceID,
      stepIndex,
      templateID,
      template: {
        name: template.Name,
        subject: template.Subject
      },
      gdprResults,
      sendResults,
      testMode: validated.testMode || false
    });
  } catch (error: any) {
    console.error('[Outreach API] POST /campaigns/:campID/send-step failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send campaign step', 
      details: error.message 
    });
  }
});

const webhookEventSchema = z.object({
  event: z.enum(['delivered', 'open', 'click', 'bounce', 'complaint', 'unsubscribe']),
  email: z.string().email(),
  campID: z.string().optional(),
  timestamp: z.string().optional(),
  bounceType: z.enum(['Hard', 'Soft']).optional(),
  metadata: z.record(z.any()).optional()
});

router.post("/webhooks/email-event", async (req, res) => {
  try {
    let emailProvider;
    try {
      emailProvider = createEmailProvider();
    } catch (error: any) {
      console.warn(`[Outreach API] Email provider not configured for webhook: ${error.message}`);
      return res.status(503).json({ 
        error: 'Email provider not configured',
        details: error.message 
      });
    }

    let signatureValid = false;
    
    if (emailProvider.name === 'brevo' || emailProvider.name === 'sendinblue') {
      signatureValid = verifyBrevoSignature(req);
      if (!signatureValid) {
        console.warn('[Outreach API] Invalid Brevo webhook signature on /webhooks/email-event');
        return res.status(401).json({ 
          error: 'Invalid webhook signature',
          provider: 'brevo'
        });
      }
    } else if (emailProvider.name === 'resend') {
      signatureValid = verifyResendSignature(req);
      if (!signatureValid) {
        console.warn('[Outreach API] Invalid Resend webhook signature on /webhooks/email-event');
        return res.status(401).json({ 
          error: 'Invalid webhook signature',
          provider: 'resend'
        });
      }
    }
    
    const validated = webhookEventSchema.parse(req.body);
    
    const day = validated.timestamp 
      ? new Date(validated.timestamp).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    
    const campID = validated.campID || "ALL";
    
    switch (validated.event) {
      case 'delivered':
        await outreachService.recordEmailStats(day, campID, { Sent: 1 });
        break;
      
      case 'open':
        await outreachService.recordEmailStats(day, campID, { Open: 1 });
        break;
      
      case 'click':
        await outreachService.recordEmailStats(day, campID, { Click: 1 });
        break;
      
      case 'bounce':
        await outreachService.recordEmailStats(day, campID, { Bounce: 1 });
        break;
      
      case 'complaint':
        await outreachService.recordEmailStats(day, campID, { Complaint: 1 });
        break;
      
      case 'unsubscribe':
        await outreachService.recordEmailStats(day, campID, { Unsub: 1 });
        await outreachService.unsubscribe(validated.email, "Email Provider Webhook", campID);
        break;
    }
    
    res.json({ 
      success: true, 
      event: validated.event,
      email: validated.email,
      processed: true 
    });
  } catch (error: any) {
    console.error('[Outreach API] POST /webhooks/email-event failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid webhook payload', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to process webhook event', 
      details: error.message 
    });
  }
});

const unsubscribeSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
  campID: z.string().optional()
});

router.post("/unsubscribe", async (req, res) => {
  try {
    const validated = unsubscribeSchema.parse(req.body);
    
    await outreachService.unsubscribe(
      validated.email,
      validated.source || "User Request",
      validated.campID
    );
    
    res.json({ 
      success: true, 
      email: validated.email,
      message: "Successfully unsubscribed" 
    });
  } catch (error: any) {
    console.error('[Outreach API] POST /unsubscribe failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to unsubscribe', 
      details: error.message 
    });
  }
});

router.post("/webhooks/:provider", async (req, res) => {
  try {
    const provider = req.params.provider.toLowerCase();
    
    let signatureValid = false;
    
    if (provider === 'brevo' || provider === 'sendinblue') {
      signatureValid = verifyBrevoSignature(req);
      if (!signatureValid) {
        console.warn('[Outreach API] Invalid Brevo webhook signature');
        return res.status(401).json({ 
          error: 'Invalid webhook signature',
          provider: 'brevo'
        });
      }
    } else if (provider === 'resend') {
      signatureValid = verifyResendSignature(req);
      if (!signatureValid) {
        console.warn('[Outreach API] Invalid Resend webhook signature');
        return res.status(401).json({ 
          error: 'Invalid webhook signature',
          provider: 'resend'
        });
      }
    } else {
      console.warn(`[Outreach API] Unknown webhook provider: ${provider}`);
      return res.status(400).json({ 
        error: 'Unknown webhook provider',
        supportedProviders: ['brevo', 'resend']
      });
    }
    
    let emailProvider;

    try {
      emailProvider = createEmailProvider();
    } catch (error: any) {
      console.warn(`[Outreach API] Email provider not configured: ${error.message}`);
      return res.status(503).json({ 
        error: 'Email provider not configured',
        details: error.message 
      });
    }

    if (emailProvider.name !== provider) {
      return res.status(400).json({ 
        error: `Provider mismatch: configured=${emailProvider.name}, requested=${provider}` 
      });
    }

    const events = emailProvider.parseWebhook(req.body, req.headers as Record<string, string>);

    for (const event of events) {
      try {
        const updates: any = {};

        // Map event types to correct Email_Queue column names
        switch (event.event) {
          case 'delivered':
            updates.Status = 'sent';
            updates.SentTS = event.timestamp;
            break;
          case 'opened':
            updates.OpenTS = event.timestamp;
            break;
          case 'clicked':
            updates.ClickTS = event.timestamp;
            break;
          case 'bounced':
            updates.Status = 'bounced';
            updates.BounceTS = event.timestamp;
            updates.LastError = event.reason || 'Bounced';
            break;
          case 'complained':
            updates.Status = 'complained';
            updates.ComplaintTS = event.timestamp;
            break;
          case 'unsubscribed':
            // Don't update status, just record timestamp
            // Actual unsubscribe handling happens below
            break;
        }

        await sheetsService.updateRow('Email_Queue', 'ProviderID', event.messageId, updates);

        if (event.event === 'unsubscribed') {
          await outreachService.unsubscribe(event.email || '', `${provider} webhook`, '');
        }

        console.log(`[Outreach Webhook] ${provider} - ${event.event} for ${event.messageId}`);
      } catch (error: any) {
        console.error(`[Outreach Webhook] Failed to process event ${event.messageId}:`, error);
      }
    }

    res.json({ 
      success: true, 
      provider,
      eventsProcessed: events.length 
    });
  } catch (error: any) {
    console.error('[Outreach API] POST /webhooks/:provider failed:', error);
    res.status(500).json({ 
      error: 'Failed to process webhook', 
      details: error.message 
    });
  }
});

router.get("/worker/metrics", async (req, res) => {
  try {
    const worker = getWorkerInstance();
    const metrics = worker.getMetrics();
    res.json(metrics);
  } catch (error: any) {
    console.error('[Outreach API] GET /worker/metrics failed:', error);
    res.status(500).json({ 
      error: 'Failed to get worker metrics', 
      details: error.message 
    });
  }
});

export function registerOutreachRoutes(app: Express) {
  app.use("/api/outreach", router);
}
