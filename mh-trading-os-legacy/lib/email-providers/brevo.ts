/**
 * Brevo (formerly Sendinblue) Email Provider
 */

import type { IEmailProvider, EmailMessage, SendResult, WebhookEvent } from './types';

export class BrevoProvider implements IEmailProvider {
  name = 'brevo';
  private apiKey: string;
  private apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Brevo API key is required');
    }
    this.apiKey = apiKey;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const payload = {
        sender: { email: message.from },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.textBody,
        htmlContent: message.htmlBody,
        ...(message.replyTo && { replyTo: { email: message.replyTo } }),
        headers: message.headers || {},
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `Brevo API error: ${response.status}`,
          retryable: response.status >= 500,
        };
      }

      return {
        success: true,
        providerMessageId: data.messageId,
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
    // Brevo sends events as an array or single object
    const events = Array.isArray(body) ? body : [body];
    
    return events.map(event => {
      const eventType = event.event?.toLowerCase();
      let normalizedEvent: WebhookEvent['event'] = 'delivered';

      // Map Brevo event types to our normalized types
      switch (eventType) {
        case 'delivered':
          normalizedEvent = 'delivered';
          break;
        case 'opened':
        case 'unique_opened':
          normalizedEvent = 'opened';
          break;
        case 'click':
        case 'unique_clicked':
          normalizedEvent = 'clicked';
          break;
        case 'hard_bounce':
        case 'soft_bounce':
        case 'invalid_email':
          normalizedEvent = 'bounced';
          break;
        case 'spam':
        case 'complaint':
          normalizedEvent = 'complained';
          break;
        case 'unsubscribed':
          normalizedEvent = 'unsubscribed';
          break;
      }

      return {
        messageId: event['message-id'] || event.messageId || '',
        event: normalizedEvent,
        timestamp: event.date || event.timestamp || new Date().toISOString(),
        email: event.email,
        url: event.link,
        reason: event.reason,
      };
    }).filter(e => e.messageId); // Filter out events without messageId
  }
}
