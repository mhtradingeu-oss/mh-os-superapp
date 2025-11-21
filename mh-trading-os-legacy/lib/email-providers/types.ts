/**
 * Email Provider Abstraction
 * 
 * Pluggable email delivery adapters for Brevo, Resend, and SMTP.
 * All providers normalize to a common interface for the worker.
 */

export interface EmailMessage {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  retryable?: boolean;
}

export interface WebhookEvent {
  messageId: string;
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed';
  timestamp: string;
  email?: string;
  url?: string;
  reason?: string;
}

export interface IEmailProvider {
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
  parseWebhook(body: any, headers: Record<string, string>): WebhookEvent[];
}
