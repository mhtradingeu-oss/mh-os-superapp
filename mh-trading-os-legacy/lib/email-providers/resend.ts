/**
 * Resend Email Provider
 */

import type { IEmailProvider, EmailMessage, SendResult, WebhookEvent } from './types';

export class ResendProvider implements IEmailProvider {
  name = 'resend';
  private apiKey: string;
  private apiUrl = 'https://api.resend.com/emails';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Resend API key is required');
    }
    this.apiKey = apiKey;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const payload = {
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.textBody,
        html: message.htmlBody,
        ...(message.replyTo && { reply_to: message.replyTo }),
        headers: message.headers || {},
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `Resend API error: ${response.status}`,
          retryable: response.status >= 500,
        };
      }

      return {
        success: true,
        providerMessageId: data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: true,
      };
    }
  }

  parseWebhook(body: any, headers: Record<string, string>): WebhookEvent[] {
    // Resend webhook format
    const event = body;
    
    if (!event.type || !event.data) {
      return [];
    }

    let normalizedEvent: WebhookEvent['event'] = 'delivered';

    // Map Resend event types
    switch (event.type) {
      case 'email.sent':
      case 'email.delivered':
        normalizedEvent = 'delivered';
        break;
      case 'email.opened':
        normalizedEvent = 'opened';
        break;
      case 'email.clicked':
        normalizedEvent = 'clicked';
        break;
      case 'email.bounced':
        normalizedEvent = 'bounced';
        break;
      case 'email.complained':
        normalizedEvent = 'complained';
        break;
      case 'email.unsubscribed':
        normalizedEvent = 'unsubscribed';
        break;
      default:
        return [];
    }

    return [{
      messageId: event.data.email_id || '',
      event: normalizedEvent,
      timestamp: event.created_at || new Date().toISOString(),
      email: event.data.to?.[0] || event.data.to,
      url: event.data.click?.link,
      reason: event.data.bounce?.message,
    }];
  }
}
