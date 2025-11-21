import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { sheetsService } from './sheets';

export interface EmailSendRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Record<string, string>;
  campaignId?: string;
  templateId?: string;
  recipientId?: string;
}

export interface EmailSendResult {
  providerMsgId: string;
  ok: boolean;
  error?: string;
}

export interface EmailHealthResult {
  ok: boolean;
  provider: string;
  detail: string;
}

export interface EmailTransportConfig {
  provider: 'smtp' | 'brevo' | 'resend';
  dryRun?: boolean;
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    replyTo?: string;
    bccLog?: string;
  };
  brevo?: {
    apiKey: string;
    senderEmail: string;
    senderName?: string;
  };
  resend?: {
    apiKey: string;
    senderEmail: string;
    senderName?: string;
  };
}

abstract class EmailAdapter {
  constructor(protected config: EmailTransportConfig) {}
  abstract send(request: EmailSendRequest): Promise<EmailSendResult>;
  abstract health(): Promise<EmailHealthResult>;
}

class SMTPAdapter extends EmailAdapter {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      if (!this.config.smtp) {
        throw new Error('SMTP config is missing');
      }
      this.transporter = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.port === 465,
        auth: {
          user: this.config.smtp.user,
          pass: this.config.smtp.pass,
        },
      });
    }
    return this.transporter;
  }

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    if (!this.config.smtp) {
      return { ok: false, providerMsgId: '', error: 'SMTP config missing' };
    }

    if (this.config.dryRun) {
      const dryRunId = `DRY-SMTP-${Date.now()}`;
      console.log(`[DRY RUN] SMTP email to ${request.to}: ${request.subject}`);
      return { ok: true, providerMsgId: dryRunId };
    }

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: this.config.smtp.from,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text || '',
        replyTo: this.config.smtp.replyTo || this.config.smtp.from,
        bcc: this.config.smtp.bccLog || undefined,
        headers: request.tags
          ? Object.entries(request.tags).reduce((acc, [k, v]) => {
              acc[`X-Tag-${k}`] = v;
              return acc;
            }, {} as Record<string, string>)
          : undefined,
      });

      return {
        ok: true,
        providerMsgId: info.messageId || `SMTP-${Date.now()}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        providerMsgId: '',
        error: error.message || 'SMTP send failed',
      };
    }
  }

  async health(): Promise<EmailHealthResult> {
    if (!this.config.smtp) {
      return { ok: false, provider: 'smtp', detail: 'SMTP config missing' };
    }

    if (this.config.dryRun) {
      return {
        ok: true,
        provider: 'smtp',
        detail: `DRY RUN mode (config: ${this.config.smtp.host}:${this.config.smtp.port})`,
      };
    }

    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return {
        ok: true,
        provider: 'smtp',
        detail: `Connected to ${this.config.smtp.host}:${this.config.smtp.port}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        provider: 'smtp',
        detail: error.message || 'SMTP connection failed',
      };
    }
  }
}

class BrevoAdapter extends EmailAdapter {
  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    if (!this.config.brevo) {
      return { ok: false, providerMsgId: '', error: 'Brevo config missing' };
    }

    if (this.config.dryRun) {
      const dryRunId = `DRY-BREVO-${Date.now()}`;
      console.log(`[DRY RUN] Brevo email to ${request.to}: ${request.subject}`);
      return { ok: true, providerMsgId: dryRunId };
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.brevo.apiKey,
        },
        body: JSON.stringify({
          sender: {
            email: this.config.brevo.senderEmail,
            name: this.config.brevo.senderName || this.config.brevo.senderEmail,
          },
          to: [{ email: request.to }],
          subject: request.subject,
          htmlContent: request.html,
          textContent: request.text,
          tags: request.tags ? Object.keys(request.tags) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          ok: false,
          providerMsgId: '',
          error: errorData.message || `Brevo API error: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        ok: true,
        providerMsgId: data.messageId || `BREVO-${Date.now()}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        providerMsgId: '',
        error: error.message || 'Brevo send failed',
      };
    }
  }

  async health(): Promise<EmailHealthResult> {
    if (!this.config.brevo) {
      return { ok: false, provider: 'brevo', detail: 'Brevo config missing' };
    }

    if (this.config.dryRun) {
      return {
        ok: true,
        provider: 'brevo',
        detail: `DRY RUN mode (sender: ${this.config.brevo.senderEmail})`,
      };
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/account', {
        headers: {
          'api-key': this.config.brevo.apiKey,
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          provider: 'brevo',
          detail: `API key invalid (${response.status})`,
        };
      }

      const data = await response.json();
      return {
        ok: true,
        provider: 'brevo',
        detail: `Connected as ${data.email || this.config.brevo.senderEmail}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        provider: 'brevo',
        detail: error.message || 'Brevo connection failed',
      };
    }
  }
}

class ResendAdapter extends EmailAdapter {
  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    if (!this.config.resend) {
      return { ok: false, providerMsgId: '', error: 'Resend config missing' };
    }

    if (this.config.dryRun) {
      const dryRunId = `DRY-RESEND-${Date.now()}`;
      console.log(`[DRY RUN] Resend email to ${request.to}: ${request.subject}`);
      return { ok: true, providerMsgId: dryRunId };
    }

    try {
      const resendTags = request.tags
        ? Object.entries(request.tags).map(([name, value]) => ({ name, value }))
        : undefined;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.resend.apiKey}`,
        },
        body: JSON.stringify({
          from: this.config.resend.senderName
            ? `${this.config.resend.senderName} <${this.config.resend.senderEmail}>`
            : this.config.resend.senderEmail,
          to: request.to,
          subject: request.subject,
          html: request.html,
          text: request.text,
          tags: resendTags,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          ok: false,
          providerMsgId: '',
          error: errorData.message || `Resend API error: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        ok: true,
        providerMsgId: data.id || `RESEND-${Date.now()}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        providerMsgId: '',
        error: error.message || 'Resend send failed',
      };
    }
  }

  async health(): Promise<EmailHealthResult> {
    if (!this.config.resend) {
      return { ok: false, provider: 'resend', detail: 'Resend config missing' };
    }

    if (this.config.dryRun) {
      return {
        ok: true,
        provider: 'resend',
        detail: `DRY RUN mode (sender: ${this.config.resend.senderEmail})`,
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.resend.apiKey}`,
        },
      });

      if (response.status === 401) {
        return {
          ok: false,
          provider: 'resend',
          detail: 'API key invalid',
        };
      }

      return {
        ok: true,
        provider: 'resend',
        detail: `API key valid (sender: ${this.config.resend.senderEmail})`,
      };
    } catch (error: any) {
      return {
        ok: false,
        provider: 'resend',
        detail: error.message || 'Resend connection failed',
      };
    }
  }
}

export class EmailTransport {
  private adapter: EmailAdapter;

  constructor(config: EmailTransportConfig) {
    switch (config.provider) {
      case 'smtp':
        this.adapter = new SMTPAdapter(config);
        break;
      case 'brevo':
        this.adapter = new BrevoAdapter(config);
        break;
      case 'resend':
        this.adapter = new ResendAdapter(config);
        break;
      default:
        throw new Error(`Unknown email provider: ${config.provider}`);
    }
  }

  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    return this.adapter.send(request);
  }

  async health(): Promise<EmailHealthResult> {
    return this.adapter.health();
  }

  static async createFromSettings(): Promise<EmailTransport> {
    const settingsRows = await sheetsService.getSettings();
    const settingsMap = settingsRows.reduce((acc: any, s: any) => {
      acc[s.Key] = s.Value || '';
      return acc;
    }, {});

    const provider = (settingsMap.EMAIL_PROVIDER || 'smtp') as 'smtp' | 'brevo' | 'resend';
    const dryRun = settingsMap.DRY_RUN === 'true' || process.env.DRY_RUN === 'true';

    const config: EmailTransportConfig = {
      provider,
      dryRun,
    };

    if (provider === 'smtp') {
      const host = process.env.SMTP_HOST || settingsMap.SMTP_HOST || '';
      const user = process.env.SMTP_USER || settingsMap.SMTP_USER || '';
      const pass = process.env.SMTP_PASS || '';
      const from = process.env.EMAIL_FROM || settingsMap.EMAIL_FROM || '';

      if (!dryRun && (!host || !user || !pass || !from)) {
        throw new Error(
          `SMTP config incomplete: missing ${[
            !host && 'SMTP_HOST',
            !user && 'SMTP_USER',
            !pass && 'SMTP_PASS',
            !from && 'EMAIL_FROM',
          ]
            .filter(Boolean)
            .join(', ')}`
        );
      }

      config.smtp = {
        host,
        port: parseInt(process.env.SMTP_PORT || settingsMap.SMTP_PORT || '587', 10),
        user,
        pass,
        from,
        replyTo: process.env.REPLY_TO || settingsMap.REPLY_TO || undefined,
        bccLog: process.env.EMAIL_BCC_LOG || settingsMap.EMAIL_BCC_LOG || undefined,
      };
    } else if (provider === 'brevo') {
      const apiKey = process.env.BREVO_API_KEY || '';
      const senderEmail = process.env.EMAIL_FROM || settingsMap.EMAIL_FROM || '';

      if (!dryRun && (!apiKey || !senderEmail)) {
        throw new Error(
          `Brevo config incomplete: missing ${[!apiKey && 'BREVO_API_KEY', !senderEmail && 'EMAIL_FROM']
            .filter(Boolean)
            .join(', ')}`
        );
      }

      config.brevo = {
        apiKey,
        senderEmail,
        senderName: settingsMap.EMAIL_SENDER_NAME || undefined,
      };
    } else if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY || '';
      const senderEmail = process.env.EMAIL_FROM || settingsMap.EMAIL_FROM || '';

      if (!dryRun && (!apiKey || !senderEmail)) {
        throw new Error(
          `Resend config incomplete: missing ${[!apiKey && 'RESEND_API_KEY', !senderEmail && 'EMAIL_FROM']
            .filter(Boolean)
            .join(', ')}`
        );
      }

      config.resend = {
        apiKey,
        senderEmail,
        senderName: settingsMap.EMAIL_SENDER_NAME || undefined,
      };
    }

    return new EmailTransport(config);
  }
}
