import { GoogleSheetsService } from './sheets';
import { EmailTransport } from './email-transport';
import { nanoid } from 'nanoid';
import { marked } from 'marked';
import type { 
  OutreachCampaign, 
  OutreachSequence, 
  OutreachTemplate,
  OutreachRecipient, 
  OutreachSend,
  OSSettings,
  CRMLead,
  Partner
} from './outreach-types';

// ==================== TYPES ====================

export interface SequenceStep {
  dayOffset: number;      // Days after campaign start
  templateId: string;     // Template to use
  channel: string;        // 'email' (future: 'sms', 'whatsapp')
}

export interface RecipientWithSource {
  recipient: OutreachRecipient;
  sourceRecord: CRMLead | Partner | Record<string, never>; // Empty object if not found
  lastStepIndex: number;  // -1 if no sends yet
  lastSendTS: string | null;
  lastStatus: string | null;
}

export interface TickResult {
  processed: number;
  sent: number;
  failed: number;
  throttled: number;
  errors: string[];
}

// ==================== SEQUENCER CLASS ====================

export class OutreachSequencer {
  constructor(
    private sheetsService: GoogleSheetsService,
    private emailTransport: EmailTransport
  ) {}

  // ==================== CAMPAIGN CONTROL ====================

  /**
   * Start a campaign - sets StartedTS and Status="RUNNING"
   */
  async startCampaign(campaignId: string, startAtTS?: string): Promise<void> {
    const campaigns = await this.sheetsService.readSheet<OutreachCampaign>('Outreach_Campaigns');
    const campaign = campaigns.find((c) => c.CampaignID === campaignId);
    
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const now = startAtTS || new Date().toISOString();
    
    await this.sheetsService.updateRow('Outreach_Campaigns', 'CampaignID', campaignId, {
      StartedTS: now,
      Status: 'RUNNING'
    });
    
    // Log to OS_Logs
    await this.logOperation('CAMPAIGN_START', `Started campaign: ${campaignId}`, { campaignId });
  }

  /**
   * Pause a campaign - sets Status="PAUSED"
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    const campaigns = await this.sheetsService.readSheet<OutreachCampaign>('Outreach_Campaigns');
    const campaign = campaigns.find((c) => c.CampaignID === campaignId);
    
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    await this.sheetsService.updateRow('Outreach_Campaigns', 'CampaignID', campaignId, {
      Status: 'PAUSED'
    });
    
    await this.logOperation('CAMPAIGN_PAUSE', `Paused campaign: ${campaignId}`, { campaignId });
  }

  /**
   * Complete a campaign - sets Status="COMPLETED" and CompletedTS
   */
  async completeCampaign(campaignId: string): Promise<void> {
    const campaigns = await this.sheetsService.readSheet<OutreachCampaign>('Outreach_Campaigns');
    const campaign = campaigns.find((c) => c.CampaignID === campaignId);
    
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    await this.sheetsService.updateRow('Outreach_Campaigns', 'CampaignID', campaignId, {
      Status: 'COMPLETED',
      CompletedTS: new Date().toISOString()
    });
    
    await this.logOperation('CAMPAIGN_COMPLETE', `Completed campaign: ${campaignId}`, { campaignId });
  }

  // ==================== TICK (Main Sending Logic) ====================

  /**
   * Process due sends for a campaign (respects throttling, retry, suppression)
   */
  async tickCampaign(campaignId: string): Promise<TickResult> {
    const result: TickResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      throttled: 0,
      errors: []
    };

    try {
      // 1. Get campaign and validate status
      const campaigns = await this.sheetsService.readSheet<OutreachCampaign>('Outreach_Campaigns');
      const campaign = campaigns.find((c) => c.CampaignID === campaignId);
      
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      if (campaign.Status !== 'RUNNING') {
        result.errors.push(`Campaign not running (Status: ${campaign.Status})`);
        return result;
      }

      if (!campaign.StartedTS) {
        result.errors.push('Campaign has no StartedTS');
        return result;
      }

      // 2. Get sequence with steps
      const sequences = await this.sheetsService.readSheet<OutreachSequence>('Outreach_Sequences');
      const sequence = sequences.find((s) => s.CampaignID === campaignId && s.ActiveFlag);
      
      if (!sequence) {
        result.errors.push('No active sequence found for campaign');
        return result;
      }

      let steps: SequenceStep[] = [];
      try {
        steps = JSON.parse(sequence.StepsJSON || '[]');
      } catch (e) {
        result.errors.push(`Invalid StepsJSON: ${e}`);
        return result;
      }

      if (steps.length === 0) {
        result.errors.push('Sequence has no steps');
        return result;
      }

      // 3. Get throttle limit from Settings
      const ratePerMin = await this.getThrottleRate();
      
      // 4. Get recipients and their send history
      const recipientsWithSource = await this.getEligibleRecipients(campaignId);
      
      // 5. Determine which recipients are due for next step
      const dueRecipients = await this.filterDueRecipients(
        recipientsWithSource,
        steps,
        campaign.StartedTS
      );

      result.processed = dueRecipients.length;

      // 6. Apply throttling
      const toSend = dueRecipients.slice(0, ratePerMin);
      result.throttled = dueRecipients.length - toSend.length;

      // 7. Send each message
      for (const item of toSend) {
        try {
          const nextStepIndex = item.lastStepIndex + 1;
          const step = steps[nextStepIndex];
          
          await this.sendStep(campaignId, sequence.SequenceID, item, step, nextStepIndex);
          result.sent++;
        } catch (e: any) {
          result.failed++;
          result.errors.push(`Send failed for ${item.recipient.RecipientID}: ${e.message}`);
        }
      }

      await this.logOperation('CAMPAIGN_TICK', `Processed ${result.processed}, sent ${result.sent}`, {
        campaignId,
        ...result
      });

    } catch (e: any) {
      result.errors.push(`Tick failed: ${e.message}`);
    }

    return result;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get throttle rate from Settings (OUTREACH_RATE_PER_MIN, default 60)
   */
  private async getThrottleRate(): Promise<number> {
    try {
      const settings = await this.sheetsService.readSheet<OSSettings>('Settings');
      const setting = settings.find((s) => s.Key === 'OUTREACH_RATE_PER_MIN');
      return setting && setting.Value ? parseInt(setting.Value, 10) : 60;
    } catch (e) {
      return 60; // Default fallback
    }
  }

  /**
   * Get eligible recipients (Status ∈ {PENDING, OPENED, CLICKED}, not unsub/suppressed)
   * with their source records and send history
   */
  /**
   * Helper to normalize boolean flags from Google Sheets (handles "TRUE", "FALSE", 1, 0, true, false)
   */
  private normalizeBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      return normalized === 'TRUE' || normalized === '1';
    }
    return false;
  }

  private async getEligibleRecipients(campaignId: string): Promise<RecipientWithSource[]> {
    // 1. Get recipients
    const recipients = await this.sheetsService.readSheet<OutreachRecipient>('Outreach_Recipients');
    const eligible = recipients.filter((r) => {
      // Normalize boolean flags
      const isUnsubscribed = this.normalizeBoolean(r.UnsubFlag);
      const isSuppressed = this.normalizeBoolean(r.SuppressedFlag);
      
      return (
        r.CampaignID === campaignId &&
        // Accept PENDING, SENT, OPENED, CLICKED (not BOUNCED, COMPLAINED, UNSUBSCRIBED)
        ['PENDING', 'SENT', 'OPENED', 'CLICKED'].includes(r.Status) &&
        !isUnsubscribed &&
        !isSuppressed
      );
    });

    // 2. Get sends history
    const sends = await this.sheetsService.readSheet<OutreachSend>('Outreach_Sends');

    // 3. Get source records (CRM_Leads and PartnerRegistry)
    const [crmLeads, partners] = await Promise.all([
      this.sheetsService.readSheet<CRMLead>('CRM_Leads'),
      this.sheetsService.readSheet<Partner>('PartnerRegistry')
    ]);

    // 4. Build result
    const result: RecipientWithSource[] = [];
    
    for (const recipient of eligible) {
      // Get source record
      let sourceRecord: CRMLead | Partner | Record<string, never> = {};
      if (recipient.SourceType === 'CRM_Leads') {
        sourceRecord = crmLeads.find((l) => l.LeadID === recipient.SourceID) || {};
      } else if (recipient.SourceType === 'PartnerRegistry') {
        sourceRecord = partners.find((p) => p.PartnerID === recipient.SourceID) || {};
      }

      // Get send history for this recipient
      const recipientSends = sends.filter((s) => s.RecipientID === recipient.RecipientID);
      
      // Find last step index and status
      let lastStepIndex = -1;
      let lastSendTS: string | null = null;
      let lastStatus: string | null = null;
      
      if (recipientSends.length > 0) {
        // Sort by SequenceStep desc to get latest
        recipientSends.sort((a, b) => {
          const aStep = typeof a.SequenceStep === 'number' ? a.SequenceStep : parseInt(String(a.SequenceStep || '0'), 10);
          const bStep = typeof b.SequenceStep === 'number' ? b.SequenceStep : parseInt(String(b.SequenceStep || '0'), 10);
          return bStep - aStep;
        });
        const lastSend = recipientSends[0];
        lastStepIndex = typeof lastSend.SequenceStep === 'number' ? lastSend.SequenceStep : parseInt(String(lastSend.SequenceStep || '0'), 10);
        lastSendTS = lastSend.TS_Sent || lastSend.TS_Queued || null;
        lastStatus = lastSend.Status;
      }

      result.push({
        recipient,
        sourceRecord,
        lastStepIndex,
        lastSendTS,
        lastStatus
      });
    }

    return result;
  }

  /**
   * Filter recipients to only those due for their next step (with retry logic)
   */
  private async filterDueRecipients(
    recipients: RecipientWithSource[],
    steps: SequenceStep[],
    campaignStartedTS: string
  ): Promise<RecipientWithSource[]> {
    const now = new Date();
    const campaignStart = new Date(campaignStartedTS);

    // Get all sends to check retry counts
    const allSends = await this.sheetsService.readSheet<OutreachSend>('Outreach_Sends');

    const result: RecipientWithSource[] = [];

    for (const item of recipients) {
      const nextStepIndex = item.lastStepIndex + 1;
      
      // No more steps?
      if (nextStepIndex >= steps.length) {
        continue;
      }

      const step = steps[nextStepIndex];
      
      // Validate step dayOffset
      if (step.dayOffset < 0) {
        continue; // Skip invalid steps
      }
      
      // Calculate due date: campaignStart + dayOffset days
      const dueDate = new Date(campaignStart);
      dueDate.setDate(dueDate.getDate() + step.dayOffset);
      
      // Check if due
      if (now < dueDate) {
        continue;
      }

      // Check retry logic for TEMP_ERROR or PERM_ERROR
      if (item.lastStatus === 'PERM_ERROR') {
        continue; // Skip permanent failures
      }

      if (item.lastStatus === 'TEMP_ERROR' && item.lastSendTS) {
        // Get the last send record for this recipient + step
        const recipientSends = allSends.filter((s) => {
          const sStep = typeof s.SequenceStep === 'number' ? s.SequenceStep : parseInt(String(s.SequenceStep || '0'), 10);
          return s.RecipientID === item.recipient.RecipientID && sStep === nextStepIndex;
        });

        if (recipientSends.length === 0) {
          continue; // Shouldn't happen, but safety check
        }

        // Get the most recent send
        recipientSends.sort((a, b) => 
          new Date(b.TS_Queued || 0).getTime() - new Date(a.TS_Queued || 0).getTime()
        );
        const lastSend = recipientSends[0];
        const retryCount = typeof lastSend.RetryCount === 'number' ? lastSend.RetryCount : parseInt(String(lastSend.RetryCount || '0'), 10);

        // Max 2 retries (0 = original send, 1 = first retry, 2 = second retry)
        if (retryCount >= 2) {
          // Mark as permanent failure after 2 retries
          await this.sheetsService.updateRow('Outreach_Sends', 'SendID', lastSend.SendID, {
            Status: 'PERM_ERROR',
            Error: (lastSend.Error || '') + ' [Max retries exceeded]'
          });
          continue;
        }

        // Check backoff timing: 10 minutes for first retry, 60 minutes for second
        const lastErrorTS = lastSend.LastErrorTS || lastSend.TS_Queued || new Date().toISOString();
        const lastError = new Date(lastErrorTS);
        const minutesSinceLastError = (now.getTime() - lastError.getTime()) / (1000 * 60);
        
        const requiredWaitMinutes = retryCount === 0 ? 10 : 60;
        
        if (minutesSinceLastError < requiredWaitMinutes) {
          continue; // Too soon to retry
        }
      }

      result.push(item);
    }

    return result;
  }

  /**
   * Send a single step to a recipient
   */
  private async sendStep(
    campaignId: string,
    sequenceId: string,
    item: RecipientWithSource,
    step: SequenceStep,
    stepIndex: number
  ): Promise<void> {
    // 1. Get template
    const templates = await this.sheetsService.readSheet<OutreachTemplate>('Outreach_Templates');
    const template = templates.find((t) => t.TemplateID === step.templateId);
    
    if (!template) {
      throw new Error(`Template not found: ${step.templateId}`);
    }

    // 2. Build merge variables context
    const mergeContext = this.buildMergeContext(item.recipient, item.sourceRecord);

    // 3. Apply merge variables to subject and body
    const subject = this.applyMergeVariables(template.Subject || '', mergeContext);
    const bodyWithVars = this.applyMergeVariables(template.BodyMarkdown || '', mergeContext);
    const html = await this.convertMarkdownToHTML(bodyWithVars);

    // 4. Generate SendID
    const sendId = `SEND-${Date.now()}-${nanoid(6)}`;

    // 5. Queue the send (write to Outreach_Sends first with Status=QUEUED)
    const sendRecord = {
      SendID: sendId,
      CampaignID: campaignId,
      SequenceID: sequenceId,
      RecipientID: item.recipient.RecipientID,
      SequenceStep: stepIndex,
      TemplateID: step.templateId,
      Channel: step.channel,
      Subject: subject,
      BodyRef: '', // Could store in file/blob storage for audit
      Status: 'QUEUED',
      ProviderMsgID: '',
      TS_Queued: new Date().toISOString(),
      TS_Sent: '',
      TS_Open: '',
      TS_Click: '',
      TS_Bounce: '',
      TS_Complaint: '',
      Error: '',
      RetryCount: '0',
      LastErrorTS: ''
    };

    await this.sheetsService.writeRows('Outreach_Sends', [sendRecord]);

    // 6. Send via EmailTransport
    try {
      const sendResult = await this.emailTransport.sendEmail({
        to: item.recipient.Email,
        subject,
        html,
        tags: {
          campaignId,
          recipientId: item.recipient.RecipientID,
          sendId
        },
        campaignId,
        templateId: step.templateId,
        recipientId: item.recipient.RecipientID
      });

      // 7. Update send record with success
      await this.sheetsService.updateRow('Outreach_Sends', 'SendID', sendId, {
        Status: 'SENT',
        ProviderMsgID: sendResult.providerMsgId || '',
        TS_Sent: new Date().toISOString()
      });

      // 8. Update recipient LastSendTS and LastResult
      await this.sheetsService.updateRow('Outreach_Recipients', 'RecipientID', item.recipient.RecipientID, {
        LastSendTS: new Date().toISOString(),
        LastResult: 'SENT'
      });

    } catch (e: any) {
      // 9. Update send record with error and retry tracking
      // Read current record to get retry count
      const sends = await this.sheetsService.readSheet<OutreachSend>('Outreach_Sends');
      const currentSend = sends.find((s) => s.SendID === sendId);
      const currentRetryCount = currentSend ? 
        (typeof currentSend.RetryCount === 'number' ? currentSend.RetryCount : parseInt(String(currentSend.RetryCount || '0'), 10)) : 0;
      
      await this.sheetsService.updateRow('Outreach_Sends', 'SendID', sendId, {
        Status: 'TEMP_ERROR',
        Error: e.message || 'Unknown error',
        RetryCount: String(currentRetryCount + 1),
        LastErrorTS: new Date().toISOString()
      });

      throw e; // Re-throw to count as failed
    }
  }

  /**
   * Build merge variables context from recipient and source record
   */
  private buildMergeContext(recipient: OutreachRecipient, sourceRecord: CRMLead | Partner | Record<string, never>): Record<string, string> {
    // Extract first name from full name (simple split)
    const firstName = (recipient.Name || '').split(' ')[0] || 'there';
    
    return {
      first_name: firstName,
      name: recipient.Name || '',
      email: recipient.Email || '',
      phone: recipient.Phone || '',
      city: recipient.City || '',
      country: recipient.CountryCode || '',
      
      // From source record (CRM_Leads or PartnerRegistry)
      company: ('Name' in sourceRecord ? sourceRecord.Name : 'PartnerName' in sourceRecord ? sourceRecord.PartnerName : '') || '',
      website: ('Website' in sourceRecord ? sourceRecord.Website : '') || '',
      address: ('Address' in sourceRecord ? sourceRecord.Address : 'Street' in sourceRecord ? sourceRecord.Street : '') || '',
      
      // Placeholder for dynamic content
      offer_link: 'https://example.com/offer', // Could be generated dynamically
      unsubscribe_link: `${process.env.APP_BASE_URL || 'http://localhost:5000'}/unsubscribe?r=${recipient.RecipientID}`
    };
  }

  /**
   * Apply merge variables to text (replace {{var}} with values)
   */
  private applyMergeVariables(text: string, context: Record<string, string>): string {
    let result = text;
    
    // Replace all {{variable}} patterns
    for (const [key, value] of Object.entries(context)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, value || '');
    }

    // Clean up any remaining unreplaced variables
    // Replace {{unknown_var}} with empty string to avoid showing placeholders
    result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result;
  }

  /**
   * Convert Markdown to HTML using marked library
   */
  private async convertMarkdownToHTML(markdown: string): Promise<string> {
    try {
      // Use marked library for proper markdown rendering
      const html = await marked.parse(markdown);
      return html;
    } catch (e) {
      // Fallback to raw text if markdown parsing fails
      console.error('Markdown parsing failed:', e);
      return `<p>${markdown}</p>`;
    }
  }

  /**
   * Log operation to OS_Logs
   */
  private async logOperation(action: string, message: string, meta: any = {}): Promise<void> {
    try {
      const logEntry = {
        LogID: `LOG-${Date.now()}-${nanoid(6)}`,
        TS: new Date().toISOString(),
        Level: 'INFO',
        Service: 'Sequencer',
        Action: action,
        Message: message,
        MetaJSON: JSON.stringify(meta)
      };
      await this.sheetsService.writeRows('OS_Logs', [logEntry]);
    } catch (e) {
      console.error('Failed to write OS_Logs:', e);
    }
  }
}
