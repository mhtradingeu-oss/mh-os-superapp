/**
 * SMTP Email Provider (using Nodemailer)
 */

import nodemailer from 'nodemailer';
import type { IEmailProvider, EmailMessage, SendResult, WebhookEvent } from './types';

export class SMTPProvider implements IEmailProvider {
  name = 'smtp';
  private transporter: any;

  constructor(config: {
    host: string;
    port: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  }) {
    if (!config.host) {
      throw new Error('SMTP host is required');
    }

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port || 587,
      secure: config.secure ?? false,
      auth: config.auth,
    });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: message.from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.textBody,
        html: message.htmlBody,
        headers: message.headers,
      });

      return {
        success: true,
        providerMessageId: info.messageId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: error.code !== 'EAUTH', // Retry unless auth error
      };
    }
  }

  parseWebhook(body: any, headers: Record<string, string>): WebhookEvent[] {
    // SMTP doesn't have native webhooks
    // This would require a custom webhook endpoint or polling service
    // For now, return empty array
    return [];
  }
}
