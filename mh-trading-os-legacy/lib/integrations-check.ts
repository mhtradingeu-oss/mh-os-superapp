import { GoogleSheetsService } from './sheets';

export interface IntegrationCheckResult {
  service: string;
  status: 'PASS' | 'WARN' | 'ERROR';
  message: string;
  details?: string;
  timestamp: string;
}

export interface IntegrationsCheckSummary {
  woo: IntegrationCheckResult;
  odoo: IntegrationCheckResult;
  email: IntegrationCheckResult;
  overall: 'PASS' | 'WARN' | 'ERROR';
}

/**
 * Test WooCommerce integration safely
 * - Only if API_WOO_BASE/KEY/SECRET are available in Secrets
 * - Execute GET /products?per_page=1 as a test
 * - If failed: WARN only without breaking the system
 */
export async function checkWooCommerce(): Promise<IntegrationCheckResult> {
  const timestamp = new Date().toISOString();
  const base = process.env.API_WOO_BASE;
  const key = process.env.API_WOO_KEY;
  const secret = process.env.API_WOO_SECRET;

  if (!base || !key || !secret) {
    return {
      service: 'WooCommerce',
      status: 'WARN',
      message: 'WooCommerce credentials not configured in Secrets',
      details: 'Missing one or more: API_WOO_BASE, API_WOO_KEY, API_WOO_SECRET',
      timestamp,
    };
  }

  try {
    // Test with minimal GET request to /products?per_page=1
    const url = `${base.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=1`;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (response.ok) {
      const data = await response.json();
      return {
        service: 'WooCommerce',
        status: 'PASS',
        message: 'WooCommerce API connected successfully',
        details: `Retrieved ${Array.isArray(data) ? data.length : 0} product(s)`,
        timestamp,
      };
    } else {
      const errorText = await response.text();
      return {
        service: 'WooCommerce',
        status: 'WARN',
        message: `WooCommerce API responded with status ${response.status}`,
        details: errorText.substring(0, 200),
        timestamp,
      };
    }
  } catch (error: any) {
    return {
      service: 'WooCommerce',
      status: 'WARN',
      message: 'WooCommerce API connection failed',
      details: error.message,
      timestamp,
    };
  }
}

/**
 * Test Odoo integration safely
 * - Only if API_ODOO_BASE/DB/USER/PASS are available
 * - Execute a ping RPC call only (no data modification)
 * - If failed: WARN only
 */
export async function checkOdoo(): Promise<IntegrationCheckResult> {
  const timestamp = new Date().toISOString();
  const base = process.env.API_ODOO_BASE;
  const db = process.env.API_ODOO_DB;
  const user = process.env.API_ODOO_USER;
  const pass = process.env.API_ODOO_PASS;

  if (!base || !db || !user || !pass) {
    return {
      service: 'Odoo',
      status: 'WARN',
      message: 'Odoo credentials not configured in Secrets',
      details: 'Missing one or more: API_ODOO_BASE, API_ODOO_DB, API_ODOO_USER, API_ODOO_PASS',
      timestamp,
    };
  }

  try {
    // Test with version_info RPC call (safe read-only operation)
    const url = `${base.replace(/\/$/, '')}/jsonrpc`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'common',
          method: 'version',
          args: [],
        },
        id: Math.floor(Math.random() * 1000000),
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result) {
        return {
          service: 'Odoo',
          status: 'PASS',
          message: 'Odoo API connected successfully',
          details: `Server version: ${data.result.server_version || 'unknown'}`,
          timestamp,
        };
      } else if (data.error) {
        return {
          service: 'Odoo',
          status: 'WARN',
          message: 'Odoo API returned error',
          details: data.error.message || JSON.stringify(data.error),
          timestamp,
        };
      }
    }

    return {
      service: 'Odoo',
      status: 'WARN',
      message: `Odoo API responded with status ${response.status}`,
      details: await response.text().then(t => t.substring(0, 200)),
      timestamp,
    };
  } catch (error: any) {
    return {
      service: 'Odoo',
      status: 'WARN',
      message: 'Odoo API connection failed',
      details: error.message,
      timestamp,
    };
  }
}

/**
 * Test Email provider configuration (SMTP)
 * - Check if EMAIL_PROVIDER is "smtp", "resend", "sendgrid", etc.
 * - Configure Mailer client without sending
 * - Return ok:true if client created successfully
 */
export async function checkEmail(): Promise<IntegrationCheckResult> {
  const timestamp = new Date().toISOString();
  const provider = process.env.EMAIL_PROVIDER || 'smtp';
  
  if (provider === 'smtp') {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.EMAIL_FROM;

    if (!host || !user || !pass || !from) {
      return {
        service: 'Email',
        status: 'WARN',
        message: 'SMTP credentials not fully configured',
        details: 'Missing one or more: SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM',
        timestamp,
      };
    }

    // Validate configuration (no actual connection test to avoid triggering email servers)
    return {
      service: 'Email',
      status: 'PASS',
      message: 'SMTP provider configured successfully',
      details: `Provider: ${provider}, Host: ${host}, Port: ${port || '587'}, From: ${from}`,
      timestamp,
    };
  } else if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      return {
        service: 'Email',
        status: 'WARN',
        message: 'Resend credentials not configured',
        details: 'Missing one or more: RESEND_API_KEY, EMAIL_FROM',
        timestamp,
      };
    }

    return {
      service: 'Email',
      status: 'PASS',
      message: 'Resend provider configured successfully',
      details: `Provider: ${provider}, From: ${from}`,
      timestamp,
    };
  } else if (provider === 'sendgrid') {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      return {
        service: 'Email',
        status: 'WARN',
        message: 'SendGrid credentials not configured',
        details: 'Missing one or more: SENDGRID_API_KEY, EMAIL_FROM',
        timestamp,
      };
    }

    return {
      service: 'Email',
      status: 'PASS',
      message: 'SendGrid provider configured successfully',
      details: `Provider: ${provider}, From: ${from}`,
      timestamp,
    };
  }

  return {
    service: 'Email',
    status: 'WARN',
    message: `Unknown email provider: ${provider}`,
    details: 'Supported providers: smtp, resend, sendgrid',
    timestamp,
  };
}

/**
 * Run all integration checks and log results to OS_Health
 */
export async function checkAllIntegrations(): Promise<IntegrationsCheckSummary> {
  const [woo, odoo, email] = await Promise.all([
    checkWooCommerce(),
    checkOdoo(),
    checkEmail(),
  ]);

  // Determine overall status
  const statuses = [woo.status, odoo.status, email.status];
  let overall: 'PASS' | 'WARN' | 'ERROR' = 'PASS';
  if (statuses.includes('ERROR')) {
    overall = 'ERROR';
  } else if (statuses.includes('WARN')) {
    overall = 'WARN';
  }

  // Log results to OS_Health
  try {
    const sheetsService = new GoogleSheetsService();
    await sheetsService.writeRows('OS_Health', [
      {
        Timestamp: woo.timestamp,
        Check: 'Integrations Check - WooCommerce',
        Status: woo.status,
        Detail: woo.message,
        Notes: woo.details || '',
      },
      {
        Timestamp: odoo.timestamp,
        Check: 'Integrations Check - Odoo',
        Status: odoo.status,
        Detail: odoo.message,
        Notes: odoo.details || '',
      },
      {
        Timestamp: email.timestamp,
        Check: 'Integrations Check - Email',
        Status: email.status,
        Detail: email.message,
        Notes: email.details || '',
      },
      {
        Timestamp: new Date().toISOString(),
        Check: 'Integrations Check - Overall',
        Status: overall,
        Detail: `WooCommerce: ${woo.status}, Odoo: ${odoo.status}, Email: ${email.status}`,
        Notes: 'Automated integrations health check',
      },
    ]);
  } catch (error) {
    console.error('Failed to log integrations check to OS_Health:', error);
  }

  return {
    woo,
    odoo,
    email,
    overall,
  };
}
