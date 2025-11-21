/**
 * Webhook Handlers for Email Provider Events
 * 
 * Supports Brevo and Resend webhooks for:
 * - unsubscribed: Update Unsubscribes, recipient.UnsubFlag, Suppression_List
 * - bounce: Update Bounce_Events, Suppression_List
 * - complaint: Update Complaint_Events, Suppression_List
 * - open: Update Outreach_Sends.TS_Open, Recipient.Status
 * - click: Update Outreach_Sends.TS_Click, Recipient.Status
 */

import type { GoogleSheetsService } from './sheets';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

// ==================== TYPES ====================

export interface WebhookEvent {
  type: 'unsubscribed' | 'bounce' | 'complaint' | 'open' | 'click' | 'delivered' | 'unknown';
  email: string;
  timestamp: string;
  campaignId?: string;
  providerMsgId?: string;
  metadata?: Record<string, any>;
}

export interface WebhookProcessResult {
  success: boolean;
  eventType: string;
  email: string;
  actions: string[];
  errors: string[];
}

// ==================== SIGNATURE VERIFICATION ====================

/**
 * Verify Brevo webhook using custom header
 * Brevo doesn't support HMAC signatures, but allows custom headers for authentication
 * Configure webhook with custom header 'X-Brevo-Webhook-Secret' in Brevo dashboard
 */
export function verifyBrevoSignature(
  headerSecret: string | undefined,
  configuredSecret: string
): boolean {
  try {
    if (!headerSecret || !configuredSecret) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(headerSecret),
      Buffer.from(configuredSecret)
    );
  } catch (error) {
    console.error('Brevo signature verification error:', error);
    return false;
  }
}

/**
 * Verify Resend webhook signature using Svix
 * Resend uses Svix for webhook signing with svix-id, svix-timestamp, svix-signature headers
 */
export function verifyResendSignature(
  rawPayload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  webhookSecret: string
): boolean {
  try {
    // Clean webhook secret (remove whsec_ prefix if present, then base64-decode)
    const secretBase64 = webhookSecret.startsWith('whsec_') 
      ? webhookSecret.slice(6) 
      : webhookSecret;
    
    // Svix secrets are base64-encoded - decode before using
    const secret = Buffer.from(secretBase64, 'base64');
    
    // Svix signed payload format: "{timestamp}.{id}.{payload}"
    const signedContent = `${svixTimestamp}.${svixId}.${rawPayload}`;
    
    // Compute expected signature (base64-encoded HMAC-SHA256)
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('base64');
    
    // Svix signature format: "v1,signature1 v1,signature2" (space-separated for multiple versions)
    const signatures = svixSignature.split(' ')
      .map(s => s.split(',')[1])
      .filter(Boolean);
    
    // Check if any signature matches
    return signatures.some(sig => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(sig),
          Buffer.from(expectedSignature)
        );
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('Resend signature verification error:', error);
    return false;
  }
}

// ==================== EVENT PARSERS ====================

/**
 * Parse Brevo webhook payload to standardized event
 */
export function parseBrevoEvent(payload: any): WebhookEvent {
  const event = payload.event || payload.type || 'unknown';
  const email = payload.email || payload['to-email'] || '';
  const timestamp = payload.date ? new Date(payload.date).toISOString() : new Date().toISOString();
  
  // Map Brevo event types to our standardized types
  let type: WebhookEvent['type'] = 'unknown';
  
  switch (event.toLowerCase()) {
    case 'unsubscribed':
    case 'unsubscribe':
      type = 'unsubscribed';
      break;
    case 'hard_bounce':
    case 'soft_bounce':
    case 'bounce':
      type = 'bounce';
      break;
    case 'spam':
    case 'complaint':
      type = 'complaint';
      break;
    case 'opened':
    case 'open':
      type = 'open';
      break;
    case 'clicked':
    case 'click':
      type = 'click';
      break;
    case 'delivered':
      type = 'delivered';
      break;
  }
  
  return {
    type,
    email: email.toLowerCase().trim(),
    timestamp,
    campaignId: payload['campaign-id'] || payload.tags?.campaignId,
    providerMsgId: payload['message-id'] || payload.id,
    metadata: {
      reason: payload.reason,
      link: payload.link,
      ip: payload.ip,
      tag: payload.tag
    }
  };
}

/**
 * Parse Resend webhook payload to standardized event
 */
export function parseResendEvent(payload: any): WebhookEvent {
  const event = payload.type || 'unknown';
  const email = payload.data?.to?.[0] || payload.data?.email || '';
  const timestamp = payload.created_at ? new Date(payload.created_at).toISOString() : new Date().toISOString();
  
  // Map Resend event types to our standardized types
  let type: WebhookEvent['type'] = 'unknown';
  
  switch (event.toLowerCase()) {
    case 'email.unsubscribed':
      type = 'unsubscribed';
      break;
    case 'email.bounced':
      type = 'bounce';
      break;
    case 'email.complained':
      type = 'complaint';
      break;
    case 'email.opened':
      type = 'open';
      break;
    case 'email.clicked':
      type = 'click';
      break;
    case 'email.delivered':
      type = 'delivered';
      break;
  }
  
  return {
    type,
    email: email.toLowerCase().trim(),
    timestamp,
    campaignId: payload.data?.tags?.campaignId,
    providerMsgId: payload.data?.email_id || payload.data?.id,
    metadata: {
      subject: payload.data?.subject,
      link: payload.data?.link,
      bounce_type: payload.data?.bounce_type
    }
  };
}

// ==================== EVENT HANDLERS ====================

export class WebhookEventHandler {
  constructor(private sheetsService: GoogleSheetsService) {}

  /**
   * Process a webhook event and update relevant sheets
   */
  async processEvent(event: WebhookEvent): Promise<WebhookProcessResult> {
    const result: WebhookProcessResult = {
      success: false,
      eventType: event.type,
      email: event.email,
      actions: [],
      errors: []
    };

    try {
      // Validate email
      if (!event.email || !event.email.includes('@')) {
        result.errors.push('Invalid email address');
        return result;
      }

      // Route to appropriate handler
      switch (event.type) {
        case 'unsubscribed':
          await this.handleUnsubscribe(event, result);
          break;
        case 'bounce':
          await this.handleBounce(event, result);
          break;
        case 'complaint':
          await this.handleComplaint(event, result);
          break;
        case 'open':
          await this.handleOpen(event, result);
          break;
        case 'click':
          await this.handleClick(event, result);
          break;
        case 'delivered':
          // Log but don't process - delivery is implicit
          await this.sheetsService.logToSheet('INFO', 'Webhook', `Email delivered: ${event.email}`);
          result.actions.push('logged_delivery');
          break;
        default:
          result.errors.push(`Unknown event type: ${event.type}`);
          await this.sheetsService.logToSheet('WARN', 'Webhook', `Unknown event type: ${event.type} for ${event.email}`);
      }

      result.success = result.errors.length === 0;

      // Log to OS_Logs
      await this.sheetsService.logToSheet(
        result.success ? 'INFO' : 'ERROR',
        'Webhook',
        `Processed ${event.type} for ${event.email}: ${result.actions.join(', ')}`
      );

    } catch (error: any) {
      result.errors.push(error.message);
      await this.sheetsService.logToSheet('ERROR', 'Webhook', `Event processing failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Handle unsubscribe event
   * - Add to Unsubscribes sheet
   * - Set recipient.UnsubFlag = TRUE
   * - Add to Suppression_List
   */
  private async handleUnsubscribe(event: WebhookEvent, result: WebhookProcessResult): Promise<void> {
    const now = new Date().toISOString();

    // 1. Add to Unsubscribes sheet
    await this.sheetsService.writeRows('Unsubscribes', [[
      nanoid(8),                    // UnsubID
      event.email,                  // Email
      now,                          // TS_Unsubscribed
      event.campaignId || '',       // CampaignID
      event.metadata?.reason || '', // Reason
      event.metadata?.ip || ''      // IP
    ]]);
    result.actions.push('added_to_unsubscribes');

    // 2. Update recipient.UnsubFlag = TRUE
    const recipients = await this.sheetsService.readSheet('Outreach_Recipients');
    const recipient = recipients.find((r: any) => r.Email?.toLowerCase().trim() === event.email);
    
    if (recipient) {
      await this.sheetsService.updateRow('Outreach_Recipients', 'Email', event.email, {
        UnsubFlag: 'TRUE',
        Status: 'UNSUBSCRIBED'
      });
      result.actions.push('updated_recipient_unsub_flag');
    }

    // 3. Add to Suppression_List
    const suppressions = await this.sheetsService.readSheet('Suppression_List');
    const exists = suppressions.some((s: any) => s.Key?.toLowerCase().trim() === event.email);
    
    if (!exists) {
      await this.sheetsService.writeRows('Suppression_List', [[
        event.email,                  // Key
        'email',                      // Type
        'unsub',                      // Reason
        now,                          // AddedTS
        event.metadata?.reason || ''  // Notes
      ]]);
      result.actions.push('added_to_suppression_list');
    }
  }

  /**
   * Handle bounce event
   * - Add to Bounce_Events sheet
   * - Add to Suppression_List
   */
  private async handleBounce(event: WebhookEvent, result: WebhookProcessResult): Promise<void> {
    const now = new Date().toISOString();

    // 1. Add to Bounce_Events sheet
    await this.sheetsService.writeRows('Bounce_Events', [[
      nanoid(8),                           // BounceID
      event.email,                         // Email
      now,                                 // TS_Bounced
      event.metadata?.bounce_type || 'hard', // BounceType (hard/soft)
      event.metadata?.reason || '',        // Reason
      event.providerMsgId || ''            // ProviderMsgID
    ]]);
    result.actions.push('added_to_bounce_events');

    // 2. Update recipient status
    const recipients = await this.sheetsService.readSheet('Outreach_Recipients');
    const recipient = recipients.find((r: any) => r.Email?.toLowerCase().trim() === event.email);
    
    if (recipient) {
      await this.sheetsService.updateRow('Outreach_Recipients', 'Email', event.email, {
        Status: 'BOUNCED'
      });
      result.actions.push('updated_recipient_status');
    }

    // 3. Add to Suppression_List (only for hard bounces)
    if (!event.metadata?.bounce_type || event.metadata.bounce_type === 'hard') {
      const suppressions = await this.sheetsService.readSheet('Suppression_List');
      const exists = suppressions.some((s: any) => s.Key?.toLowerCase().trim() === event.email);
      
      if (!exists) {
        await this.sheetsService.writeRows('Suppression_List', [[
          event.email,                  // Key
          'email',                      // Type
          'bounce',                     // Reason
          now,                          // AddedTS
          event.metadata?.reason || ''  // Notes
        ]]);
        result.actions.push('added_to_suppression_list');
      }
    }
  }

  /**
   * Handle complaint event
   * - Add to Complaint_Events sheet
   * - Add to Suppression_List
   */
  private async handleComplaint(event: WebhookEvent, result: WebhookProcessResult): Promise<void> {
    const now = new Date().toISOString();

    // 1. Add to Complaint_Events sheet
    await this.sheetsService.writeRows('Complaint_Events', [[
      nanoid(8),                    // ComplaintID
      event.email,                  // Email
      now,                          // TS_Complained
      event.metadata?.reason || '', // Reason
      event.providerMsgId || ''     // ProviderMsgID
    ]]);
    result.actions.push('added_to_complaint_events');

    // 2. Update recipient status
    const recipients = await this.sheetsService.readSheet('Outreach_Recipients');
    const recipient = recipients.find((r: any) => r.Email?.toLowerCase().trim() === event.email);
    
    if (recipient) {
      await this.sheetsService.updateRow('Outreach_Recipients', 'Email', event.email, {
        Status: 'COMPLAINED'
      });
      result.actions.push('updated_recipient_status');
    }

    // 3. Add to Suppression_List
    const suppressions = await this.sheetsService.readSheet('Suppression_List');
    const exists = suppressions.some((s: any) => s.Key?.toLowerCase().trim() === event.email);
    
    if (!exists) {
      await this.sheetsService.writeRows('Suppression_List', [[
        event.email,                  // Key
        'email',                      // Type
        'complaint',                  // Reason
        now,                          // AddedTS
        event.metadata?.reason || ''  // Notes
      ]]);
      result.actions.push('added_to_suppression_list');
    }
  }

  /**
   * Handle open event
   * - Update Outreach_Sends.TS_Open
   * - Update Recipient.Status = "OPENED"
   */
  private async handleOpen(event: WebhookEvent, result: WebhookProcessResult): Promise<void> {
    const now = new Date().toISOString();

    // 1. Update Outreach_Sends.TS_Open
    const sends = await this.sheetsService.readSheet('Outreach_Sends');
    const send = sends.find((s: any) => 
      s.Email?.toLowerCase().trim() === event.email &&
      (event.providerMsgId ? s.ProviderMsgID === event.providerMsgId : true)
    ) as any;
    
    if (send?.SendID) {
      await this.sheetsService.updateRow('Outreach_Sends', 'SendID', send.SendID, {
        TS_Open: now
      });
      result.actions.push('updated_send_ts_open');
    }

    // 2. Update Recipient.Status = "OPENED"
    const recipients = await this.sheetsService.readSheet('Outreach_Recipients');
    const recipient = recipients.find((r: any) => r.Email?.toLowerCase().trim() === event.email) as any;
    
    if (recipient && recipient.Status !== 'CLICKED') { // Don't downgrade from CLICKED
      await this.sheetsService.updateRow('Outreach_Recipients', 'Email', event.email, {
        Status: 'OPENED'
      });
      result.actions.push('updated_recipient_status');
    }
  }

  /**
   * Handle click event
   * - Update Outreach_Sends.TS_Click
   * - Update Recipient.Status = "CLICKED"
   */
  private async handleClick(event: WebhookEvent, result: WebhookProcessResult): Promise<void> {
    const now = new Date().toISOString();

    // 1. Update Outreach_Sends.TS_Click
    const sends = await this.sheetsService.readSheet('Outreach_Sends');
    const send = sends.find((s: any) => 
      s.Email?.toLowerCase().trim() === event.email &&
      (event.providerMsgId ? s.ProviderMsgID === event.providerMsgId : true)
    ) as any;
    
    if (send?.SendID) {
      await this.sheetsService.updateRow('Outreach_Sends', 'SendID', send.SendID, {
        TS_Click: now
      });
      result.actions.push('updated_send_ts_click');
    }

    // 2. Update Recipient.Status = "CLICKED"
    const recipients = await this.sheetsService.readSheet('Outreach_Recipients');
    const recipient = recipients.find((r: any) => r.Email?.toLowerCase().trim() === event.email);
    
    if (recipient) {
      await this.sheetsService.updateRow('Outreach_Recipients', 'Email', event.email, {
        Status: 'CLICKED'
      });
      result.actions.push('updated_recipient_status');
    }
  }
}
