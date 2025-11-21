/**
 * Outreach Email Delivery Worker
 * 
 * Production-grade email sending pipeline with:
 * - Rate limiting (per-recipient + global)
 * - Idempotency (MessageKey deduplication)
 * - Concurrency control
 * - Exponential backoff retries
 * - GDPR compliance checks
 * - Stats aggregation
 * - Health monitoring
 */

import crypto from 'crypto';
import pLimit from 'p-limit';
import { createEmailProvider, type IEmailProvider, type EmailMessage } from '../lib/email-providers';
import { sheetsService } from '../lib/sheets';
import { outreachService } from '../lib/outreach-service';
import type { EmailOutbox } from '@shared/schema';

// Environment configuration
const CONCURRENCY = parseInt(process.env.OUTREACH_WORKER_CONCURRENCY || '3', 10);
const RPM_LIMIT = parseInt(process.env.OUTREACH_RPM || '60', 10);
const RECIPIENT_HOURLY_LIMIT = 20;
const MAX_RETRIES = 5;
const BACKOFF_MS = [250, 500, 1000, 2000, 4000]; // Exponential backoff
const DRY_RUN = process.env.OUTREACH_DRY_RUN === 'true';
const POLL_INTERVAL_MS = 5000; // 5 seconds when idle
const BATCH_SIZE = 50;
const RATE_SYNC_INTERVAL_MS = 300000; // Sync rate limits to sheets every 5min

interface RateLimits {
  perRecipient: Map<string, number[]>; // email -> timestamps[]
  global: number[]; // timestamps[]
  lastSync: number;
}

interface SendStats {
  campaignID: string;
  day: string;
  sent: number;
  failed: number;
}

interface WorkerMetrics {
  lastRunTS: string;
  messagesSent: number;
  messagesFailed: number;
  messagesSkipped: number;
  currentRPM: number;
  queueSize: number;
  errors: Array<{ ts: string; error: string; msgID: string }>;
}

export class OutreachWorker {
  private running = false;
  private provider: IEmailProvider;
  private rateLimits: RateLimits;
  private metrics: WorkerMetrics;
  private shutdownRequested = false;

  constructor() {
    try {
      this.provider = createEmailProvider();
      console.log(`[OutreachWorker] Using provider: ${this.provider.name}`);
    } catch (error: any) {
      console.error('[OutreachWorker] Failed to create email provider:', error.message);
      console.log('[OutreachWorker] Worker will start but cannot send emails until provider is configured');
      this.provider = null as any; // Worker can start but won't send
    }

    this.rateLimits = {
      perRecipient: new Map(),
      global: [],
      lastSync: Date.now(),
    };

    this.metrics = {
      lastRunTS: new Date().toISOString(),
      messagesSent: 0,
      messagesFailed: 0,
      messagesSkipped: 0,
      currentRPM: 0,
      queueSize: 0,
      errors: [],
    };
  }

  /**
   * Start the worker with continuous polling and graceful shutdown
   */
  async start() {
    if (this.running) {
      console.log('[OutreachWorker] Already running');
      return;
    }

    this.running = true;
    this.shutdownRequested = false;
    console.log('[OutreachWorker] Starting email delivery worker');
    console.log(`[OutreachWorker] Config: concurrency=${CONCURRENCY}, rpm=${RPM_LIMIT}, dryRun=${DRY_RUN}`);

    // Log startup to OS_Health
    await this.logStartup();

    // Health check interval: log to OS_Health every 5 minutes (avoid polluting sheet)
    let lastHealthLog = Date.now(); // Initialize to now so first log happens after 5 minutes
    const HEALTH_LOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    // Main loop
    while (this.running && !this.shutdownRequested) {
      try {
        await this.processQueue();
        
        // Log to OS_Health every 5 minutes (not every loop iteration)
        if (Date.now() - lastHealthLog > HEALTH_LOG_INTERVAL_MS) {
          await this.updateHealth();
          lastHealthLog = Date.now();
        }
        
        // Periodic rate limit sync to sheets
        if (Date.now() - this.rateLimits.lastSync > RATE_SYNC_INTERVAL_MS) {
          await this.syncRateLimits();
        }
      } catch (error: any) {
        console.error('[OutreachWorker] Queue processing error:', error);
        await this.logError('WORKER_ERROR', error.message, 'SYSTEM');
      }

      // Adaptive sleep: 5s when idle, 1s when busy
      const sleepTime = this.metrics.queueSize === 0 ? POLL_INTERVAL_MS : 1000;
      await this.sleep(sleepTime);
    }

    console.log('[OutreachWorker] Stopped');
    
    // Log shutdown to OS_Health
    await this.logShutdown();
  }

  /**
   * Request graceful shutdown
   */
  async stop() {
    console.log('[OutreachWorker] Shutdown requested');
    this.shutdownRequested = true;
    this.running = false;
  }

  /**
   * Main queue processing logic
   */
  private async processQueue() {
    // Fetch queued messages
    const messages = await this.fetchQueuedMessages();
    this.metrics.queueSize = messages.length;

    if (messages.length === 0) {
      return;
    }

    console.log(`[OutreachWorker] Processing ${messages.length} messages`);

    // Batch fetch contacts for personalization
    const contacts = await this.fetchContacts(messages);

    // Process with concurrency control
    const limit = pLimit(CONCURRENCY);
    const results = await Promise.all(
      messages.map(msg => limit(() => this.sendMessage(msg, contacts)))
    );

    // Aggregate stats
    await this.aggregateStats(results);

    // Update metrics
    this.metrics.lastRunTS = new Date().toISOString();
    this.cleanupOldTimestamps();
  }

  /**
   * Fetch messages ready to be sent
   */
  private async fetchQueuedMessages(): Promise<EmailOutbox[]> {
    try {
      const allMessages = await sheetsService.readSheet<EmailOutbox>('Email_Queue', false);

      const now = new Date();
      
      // First filter sync checks
      const syncFiltered = allMessages.filter((msg: EmailOutbox) => {
        // Must be queued or sending
        const status = msg.Status?.toLowerCase();
        if (status !== 'queued' && status !== 'sending') {
          return false;
        }

        // Skip if NextRetryTS is in the future
        if (msg.NextRetryTS) {
          const retryTime = new Date(msg.NextRetryTS);
          if (retryTime > now) {
            return false;
          }
        }

        // Skip if already has ProviderID or SentTS (idempotency)
        if (msg.ProviderID || msg.SentTS) {
          return false;
        }

        return true;
      });

      // Then filter by campaign approval (async check)
      const approvedMessages: EmailOutbox[] = [];
      for (const msg of syncFiltered.slice(0, BATCH_SIZE)) {
        if (!msg.CampID || await this.isCampaignApproved(msg.CampID)) {
          approvedMessages.push(msg);
        } else {
          // Campaign not approved - keep queued, retry in 5 minutes
          console.log(`[OutreachWorker] Campaign ${msg.CampID} not approved - message ${msg.MsgID} will retry in 5 minutes`);
          const retryTime = new Date(Date.now() + 300000); // 5 minutes
          await this.updateMessageStatus(msg.MsgID, {
            Status: 'queued', // ✅ Keep queued, not failed
            NextRetryTS: retryTime.toISOString(),
            LastError: 'Campaign not approved yet - retrying',
          });
          this.metrics.messagesSkipped++;
        }
      }

      return approvedMessages;
    } catch (error: any) {
      console.error('[OutreachWorker] Failed to fetch messages:', error);
      return [];
    }
  }

  /**
   * Check if campaign is approved
   */
  private async isCampaignApproved(campID: string): Promise<boolean> {
    try {
      const campaigns = await sheetsService.readSheet<any>('Outreach_Campaigns', false);
      const campaign = campaigns.find((c: any) => c.CampaignID === campID);
      
      if (!campaign) {
        console.warn(`[OutreachWorker] Campaign ${campID} not found`);
        return false;
      }
      
      const status = campaign.Status?.toUpperCase();
      const approved = status === 'ACTIVE' || status === 'APPROVED';
      
      if (!approved) {
        console.log(`[OutreachWorker] Campaign ${campID} not approved (status: ${status})`);
      }
      
      return approved;
    } catch (error: any) {
      console.error(`[OutreachWorker] Error checking campaign approval:`, error);
      return false; // Fail closed - don't send if can't verify
    }
  }

  /**
   * Batch fetch contacts for personalization
   */
  private async fetchContacts(messages: EmailOutbox[]): Promise<Map<string, any>> {
    try {
      const contacts = await sheetsService.readSheet<any>('Outreach_Contacts', false);
      
      // Create map by email
      const contactMap = new Map();
      contacts.forEach((contact: any) => {
        if (contact.Email) {
          contactMap.set(contact.Email, contact);
        }
      });
      
      return contactMap;
    } catch (error: any) {
      console.error('[OutreachWorker] Failed to fetch contacts:', error);
      return new Map();
    }
  }

  /**
   * Send a single message with all safety checks
   */
  private async sendMessage(
    msg: EmailOutbox,
    contacts: Map<string, any>
  ): Promise<{ success: boolean; campaignID: string; day: string }> {
    const campaignID = msg.CampID || 'unknown';
    const day = new Date().toISOString().split('T')[0];

    try {
      // 1. Check idempotency
      const messageKey = this.computeMessageKey(msg);
      if (msg.MessageKey && msg.MessageKey === messageKey && msg.ProviderID) {
        console.log(`[OutreachWorker] Skipping duplicate message: ${msg.MsgID}`);
        this.metrics.messagesSkipped++;
        return { success: false, campaignID, day };
      }

      // 2. Check rate limits
      if (!this.checkRateLimits(msg.To)) {
        console.log(`[OutreachWorker] Rate limit exceeded for: ${msg.To}`);
        await this.updateMessageStatus(msg.MsgID, {
          Status: 'queued',
          NextRetryTS: new Date(Date.now() + 3600000).toISOString(), // Retry in 1 hour
          LastError: 'Rate limit exceeded',
        });
        this.metrics.messagesSkipped++;
        return { success: false, campaignID, day };
      }

      // 3. Check GDPR/suppression (check Unsubscribes sheet)
      try {
        const unsubs = await sheetsService.readSheet<any>('Unsubscribes', false);
        const isUnsubscribed = unsubs.some((u: any) => u.Email === msg.To);
        if (isUnsubscribed) {
          console.log(`[OutreachWorker] Suppressed recipient: ${msg.To}`);
          await this.updateMessageStatus(msg.MsgID, {
            Status: 'failed',
            LastError: 'Recipient unsubscribed',
          });
          this.metrics.messagesSkipped++;
          return { success: false, campaignID, day };
        }
      } catch (error: any) {
        // If Unsubscribes sheet doesn't exist, continue
        console.warn(`[OutreachWorker] Could not check unsubscribes: ${error.message}`);
      }

      // 4. Personalize message
      const contact = contacts.get(msg.To) || {};
      const personalizedBody = this.personalizeContent(msg.Body || '', contact);
      const personalizedSubject = this.personalizeContent(msg.Subject, contact);

      // 5. Prepare email
      const emailMessage: EmailMessage = {
        to: msg.To,
        from: process.env.OUTREACH_FROM_EMAIL || 'noreply@company.com',
        replyTo: process.env.OUTREACH_REPLY_TO_EMAIL,
        subject: personalizedSubject,
        textBody: this.stripHTML(personalizedBody),
        htmlBody: this.convertMarkdownToHTML(personalizedBody),
        headers: {
          'X-Campaign-ID': campaignID,
          'X-Message-ID': msg.MsgID,
        },
      };

      // 6. Dry run mode
      if (DRY_RUN) {
        console.log(`[OutreachWorker] [DRY-RUN] Would send to ${msg.To}: ${personalizedSubject}`);
        await this.logInfo(`Dry-run send to ${msg.To}`, msg.MsgID);
        this.metrics.messagesSent++;
        return { success: true, campaignID, day };
      }

      // 7. Send via provider
      if (!this.provider) {
        throw new Error('Email provider not configured');
      }

      const result = await this.provider.send(emailMessage);

      // 8. Handle result
      if (result.success) {
        console.log(`[OutreachWorker] Sent ${msg.MsgID} to ${msg.To} (Provider: ${result.providerMessageId})`);
        
        await this.updateMessageStatus(msg.MsgID, {
          Status: 'sent',
          ProviderID: result.providerMessageId,
          SentTS: new Date().toISOString(),
          MessageKey: messageKey,
          Attempts: (msg.Attempts || 0) + 1,
        });

        // Track rate limit
        this.recordSend(msg.To);
        this.metrics.messagesSent++;
        
        return { success: true, campaignID, day };
      } else {
        // Handle failure with retry logic
        const attempts = (msg.Attempts || 0) + 1;
        const shouldRetry = result.retryable && attempts < MAX_RETRIES;

        if (shouldRetry) {
          const backoffMs = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
          await this.updateMessageStatus(msg.MsgID, {
            Status: 'queued',
            Attempts: attempts,
            NextRetryTS: new Date(Date.now() + backoffMs).toISOString(),
            LastError: result.error || 'Unknown error',
            MessageKey: messageKey,
          });
          console.log(`[OutreachWorker] Failed ${msg.MsgID} (attempt ${attempts}/${MAX_RETRIES}), retry in ${backoffMs}ms`);
        } else {
          await this.updateMessageStatus(msg.MsgID, {
            Status: 'failed',
            Attempts: attempts,
            LastError: result.error || 'Max retries exceeded',
            MessageKey: messageKey,
          });
          console.log(`[OutreachWorker] Permanently failed ${msg.MsgID}: ${result.error}`);
        }

        await this.logError(msg.MsgID, result.error || 'Unknown error', msg.To);
        this.metrics.messagesFailed++;
        
        return { success: false, campaignID, day };
      }
    } catch (error: any) {
      console.error(`[OutreachWorker] Error sending ${msg.MsgID}:`, error);
      
      const attempts = (msg.Attempts || 0) + 1;
      const shouldRetry = attempts < MAX_RETRIES;

      if (shouldRetry) {
        const backoffMs = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
        await this.updateMessageStatus(msg.MsgID, {
          Status: 'queued',
          Attempts: attempts,
          NextRetryTS: new Date(Date.now() + backoffMs).toISOString(),
          LastError: error.message,
        });
      } else {
        await this.updateMessageStatus(msg.MsgID, {
          Status: 'failed',
          Attempts: attempts,
          LastError: error.message,
        });
      }

      await this.logError(msg.MsgID, error.message, msg.To);
      this.metrics.messagesFailed++;
      
      return { success: false, campaignID, day };
    }
  }

  /**
   * Compute idempotency key
   */
  private computeMessageKey(msg: EmailOutbox): string {
    const parts = [
      msg.CampID || '',
      String(msg.SeqStep || ''),
      msg.To,
      msg.Subject,
      msg.Body || ''
    ];
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
  }

  /**
   * Check if sending is allowed by rate limits
   */
  private checkRateLimits(email: string): boolean {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneMinuteAgo = now - 60000;

    // Check per-recipient limit (20 per hour)
    const recipientTimestamps = this.rateLimits.perRecipient.get(email) || [];
    const recentRecipientSends = recipientTimestamps.filter(ts => ts > oneHourAgo);
    if (recentRecipientSends.length >= RECIPIENT_HOURLY_LIMIT) {
      return false;
    }

    // Check global limit (RPM)
    const recentGlobalSends = this.rateLimits.global.filter(ts => ts > oneMinuteAgo);
    if (recentGlobalSends.length >= RPM_LIMIT) {
      return false;
    }

    return true;
  }

  /**
   * Record a successful send for rate limiting
   */
  private recordSend(email: string) {
    const now = Date.now();
    
    // Record for recipient
    const recipientTimestamps = this.rateLimits.perRecipient.get(email) || [];
    recipientTimestamps.push(now);
    this.rateLimits.perRecipient.set(email, recipientTimestamps);

    // Record globally
    this.rateLimits.global.push(now);
  }

  /**
   * Clean up old timestamps to prevent memory growth
   */
  private cleanupOldTimestamps() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Clean per-recipient
    Array.from(this.rateLimits.perRecipient.entries()).forEach(([email, timestamps]) => {
      const filtered = timestamps.filter((ts: number) => ts > oneHourAgo);
      if (filtered.length === 0) {
        this.rateLimits.perRecipient.delete(email);
      } else {
        this.rateLimits.perRecipient.set(email, filtered);
      }
    });

    // Clean global
    this.rateLimits.global = this.rateLimits.global.filter((ts: number) => ts > oneHourAgo);

    // Update current RPM metric
    const oneMinuteAgo = now - 60000;
    this.metrics.currentRPM = this.rateLimits.global.filter((ts: number) => ts > oneMinuteAgo).length;
  }

  /**
   * Sync rate limits to sheets (optional persistence)
   */
  private async syncRateLimits() {
    // TODO: Optionally persist rate limits to a sheet for multi-instance coordination
    this.rateLimits.lastSync = Date.now();
    console.log('[OutreachWorker] Rate limits synced');
  }

  /**
   * Personalize content with merge tokens
   */
  private personalizeContent(template: string, contact: any): string {
    let result = template;
    
    // Replace common merge variables
    const replacements: Record<string, string> = {
      '{{first_name}}': contact.Name?.split(' ')[0] || '',
      '{{name}}': contact.Name || '',
      '{{email}}': contact.Email || '',
      '{{city}}': contact.City || '',
      '{{phone}}': contact.Phone || '',
      '{{company}}': contact.Company || '',
    };

    for (const [token, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(token, 'g'), value);
    }

    return result;
  }

  /**
   * Convert markdown to HTML (simple implementation)
   */
  private convertMarkdownToHTML(markdown: string): string {
    // Simple markdown conversions
    let html = markdown;
    
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    
    return html;
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/<br>/g, '\n')
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Update message status in Email_Queue
   */
  private async updateMessageStatus(msgID: string, updates: Partial<EmailOutbox>) {
    try {
      await sheetsService.updateRow('Email_Queue', 'MsgID', msgID, updates);
    } catch (error: any) {
      console.error(`[OutreachWorker] Failed to update message ${msgID}:`, error);
    }
  }

  /**
   * Aggregate and flush stats to Email_Stats
   */
  private async aggregateStats(results: Array<{ success: boolean; campaignID: string; day: string }>) {
    const stats = new Map<string, { sent: number; failed: number }>();

    results.forEach(result => {
      const key = `${result.campaignID}|${result.day}`;
      const current = stats.get(key) || { sent: 0, failed: 0 };
      if (result.success) {
        current.sent++;
      } else {
        current.failed++;
      }
      stats.set(key, current);
    });

    // Batch update to Email_Stats
    Array.from(stats.entries()).forEach(async ([key, counts]) => {
      const [campaignID, day] = key.split('|');
      await this.updateStats(campaignID, day, counts.sent);
    });
  }

  /**
   * Update Email_Stats sheet
   */
  private async updateStats(campaignID: string, day: string, sentCount: number) {
    try {
      const statsID = `${day}|${campaignID}`;
      const allStats = await sheetsService.readSheet<any>('Email_Stats', false);
      const existing = allStats.find((s: any) => s.StatsID === statsID);
      
      if (existing) {
        await sheetsService.updateRow('Email_Stats', 'StatsID', statsID, {
          Sent: (existing.Sent || 0) + sentCount,
        });
      } else {
        await sheetsService.writeRows('Email_Stats', [{
          StatsID: statsID,
          CampaignID: campaignID,
          Day: day,
          Sent: sentCount,
          Opened: 0,
          Clicked: 0,
          Bounced: 0,
          Unsubscribed: 0,
        }]);
      }
    } catch (error: any) {
      console.error('[OutreachWorker] Failed to update stats:', error);
    }
  }

  /**
   * Log worker startup to OS_Health
   */
  private async logStartup() {
    try {
      await sheetsService.writeRows('OS_Health', [{
        CheckTS: new Date().toISOString(),
        Component: 'Outreach Worker',
        Status: this.provider ? 'PASS' : 'WARN',
        Message: `Worker started: concurrency=${CONCURRENCY}, rpm=${RPM_LIMIT}, dryRun=${DRY_RUN}, provider=${this.provider ? 'configured' : 'not configured'}`,
        Details: JSON.stringify({
          concurrency: CONCURRENCY,
          rpmLimit: RPM_LIMIT,
          dryRun: DRY_RUN,
          provider: this.provider ? 'configured' : 'none',
        }),
      }]);
    } catch (error: any) {
      console.error('[OutreachWorker] Failed to log startup:', error.message);
    }
  }

  /**
   * Log worker shutdown to OS_Health
   */
  private async logShutdown() {
    try {
      await sheetsService.writeRows('OS_Health', [{
        CheckTS: new Date().toISOString(),
        Component: 'Outreach Worker',
        Status: 'INFO',
        Message: `Worker stopped: Sent=${this.metrics.messagesSent}, Failed=${this.metrics.messagesFailed}, Skipped=${this.metrics.messagesSkipped}`,
        Details: JSON.stringify({
          messagesSent: this.metrics.messagesSent,
          messagesFailed: this.metrics.messagesFailed,
          messagesSkipped: this.metrics.messagesSkipped,
          queueSize: this.metrics.queueSize,
        }),
      }]);
    } catch (error: any) {
      console.error('[OutreachWorker] Failed to log shutdown:', error.message);
    }
  }

  /**
   * Log periodic worker status to OS_Health (called every 5 minutes)
   */
  private async updateHealth() {
    try {
      const health = {
        CheckTS: new Date().toISOString(),
        Component: 'Outreach Worker',
        Status: this.provider ? 'PASS' : 'WARN',
        Message: this.provider 
          ? `Heartbeat: Sent=${this.metrics.messagesSent}, Failed=${this.metrics.messagesFailed}, Skipped=${this.metrics.messagesSkipped}, Queue=${this.metrics.queueSize}`
          : 'Email provider not configured',
        Details: JSON.stringify({
          queueSize: this.metrics.queueSize,
          currentRPM: this.metrics.currentRPM,
          rpmLimit: RPM_LIMIT,
          dryRun: DRY_RUN,
          messagesSent: this.metrics.messagesSent,
          messagesFailed: this.metrics.messagesFailed,
          messagesSkipped: this.metrics.messagesSkipped,
        }),
      };

      // OS_Health is append-only log, not a status table
      await sheetsService.writeRows('OS_Health', [health]);
    } catch (error: any) {
      // Silently fail to avoid infinite loops
      console.error('[OutreachWorker] Failed to log health:', error.message);
    }
  }

  /**
   * Log error to OS_Logs
   */
  private async logError(context: string, error: string, email?: string) {
    try {
      await sheetsService.logToSheet('ERROR', 'OutreachWorker', `${context}: ${error}`, email);

      // Keep last 50 errors in metrics
      this.metrics.errors.unshift({
        ts: new Date().toISOString(),
        error,
        msgID: context,
      });
      this.metrics.errors = this.metrics.errors.slice(0, 50);
    } catch (err: any) {
      console.error('[OutreachWorker] Failed to log error:', err);
    }
  }

  /**
   * Log info to OS_Logs
   */
  private async logInfo(message: string, context?: string) {
    try {
      await sheetsService.logToSheet('INFO', 'OutreachWorker', message, context);
    } catch (err: any) {
      console.error('[OutreachWorker] Failed to log info:', err);
    }
  }

  /**
   * Get current metrics for UI/API
   */
  getMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let workerInstance: OutreachWorker | null = null;

export function getWorkerInstance(): OutreachWorker {
  if (!workerInstance) {
    workerInstance = new OutreachWorker();
  }
  return workerInstance;
}

export async function startWorker() {
  const worker = getWorkerInstance();
  await worker.start();
}

export async function stopWorker() {
  if (workerInstance) {
    await workerInstance.stop();
  }
}
