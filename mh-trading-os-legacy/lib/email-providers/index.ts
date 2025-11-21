/**
 * Email Provider Factory
 * 
 * Creates the appropriate email provider based on environment configuration.
 */

import { BrevoProvider } from './brevo';
import { ResendProvider } from './resend';
import { SMTPProvider } from './smtp';
import type { IEmailProvider } from './types';

export * from './types';
export { BrevoProvider, ResendProvider, SMTPProvider };

export function createEmailProvider(): IEmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'brevo';

  switch (provider.toLowerCase()) {
    case 'brevo':
    case 'sendinblue': {
      const apiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
      if (!apiKey) {
        throw new Error('BREVO_API_KEY environment variable is required for Brevo provider');
      }
      return new BrevoProvider(apiKey);
    }

    case 'resend': {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error('RESEND_API_KEY environment variable is required for Resend provider');
      }
      return new ResendProvider(apiKey);
    }

    case 'smtp': {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!host) {
        throw new Error('SMTP_HOST environment variable is required for SMTP provider');
      }

      return new SMTPProvider({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
    }

    default:
      throw new Error(`Unsupported email provider: ${provider}. Use 'brevo', 'resend', or 'smtp'`);
  }
}
