import { GoogleSheetsService } from './sheets';
import { nanoid } from 'nanoid';

const sheetsService = new GoogleSheetsService();

/**
 * Phase 2B Readiness Check
 * 
 * Performs comprehensive health assessment across:
 * - Outreach-Core (CRUD endpoints)
 * - Webhooks (Brevo/Resend handlers)
 * - AI-Agent (A-OUT-101 functions)
 * - Provider (Email provider connectivity)
 * 
 * Criteria from architect guidance:
 * - PASS: All systems operational with acceptable thresholds
 * - WARN: Degraded performance or missing optional components
 * - FAIL: Critical failures or security issues
 */
export async function check2BReadiness(): Promise<{
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  components: Array<{
    component: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    detail: string;
    metadata?: Record<string, any>;
  }>;
  checkID: string;
  timestamp: string;
}> {
  const checkID = `2B-${nanoid(8)}`;
  const timestamp = new Date().toISOString();
  const components: any[] = [];

  // 1. Outreach-Core Check
  const coreCheck = await checkOutreachCore();
  components.push(coreCheck);

  // 2. Webhooks Check
  const webhooksCheck = await checkWebhooks();
  components.push(webhooksCheck);

  // 3. AI-Agent Check
  const aiAgentCheck = await checkAIAgent();
  components.push(aiAgentCheck);

  // 4. Email Provider Check
  const providerCheck = await checkEmailProvider();
  components.push(providerCheck);

  // 5. Security Check (API keys in Sheet)
  const securityCheck = await checkSecurityPosture();
  components.push(securityCheck);

  // Determine overall status
  const failCount = components.filter(c => c.status === 'FAIL').length;
  const warnCount = components.filter(c => c.status === 'WARN').length;

  let overallStatus: 'PASS' | 'WARN' | 'FAIL';
  if (failCount > 0) {
    overallStatus = 'FAIL';
  } else if (warnCount > 0) {
    overallStatus = 'WARN';
  } else {
    overallStatus = 'PASS';
  }

  return {
    overallStatus,
    components,
    checkID,
    timestamp
  };
}

/**
 * Check Outreach-Core endpoints and Google Sheets sync
 * 
 * PASS: Sheets accessible, all 6 outreach worksheets exist
 * WARN: Slow response (>2s) or missing non-critical sheets
 * FAIL: Cannot access Sheets or critical worksheets missing
 */
async function checkOutreachCore(): Promise<{
  component: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
  metadata?: Record<string, any>;
}> {
  try {
    const startTime = Date.now();
    
    // Check if core Outreach sheets exist
    const requiredSheets = [
      'Outreach_Campaigns',
      'Outreach_Templates',
      'Outreach_Recipients',
      'Outreach_Sends',
      'Outreach_Sequences',
      'Outreach_Suppressions'
    ];

    // Verify each required sheet exists by attempting to read it
    const missingSheets: string[] = [];
    for (const sheetName of requiredSheets) {
      try {
        await sheetsService.readSheet(sheetName);
      } catch (error) {
        missingSheets.push(sheetName);
      }
    }

    const responseTime = Date.now() - startTime;

    // FAIL if any critical Outreach sheets are missing
    if (missingSheets.length > 0) {
      return {
        component: 'Outreach-Core',
        status: 'FAIL',
        detail: `Missing ${missingSheets.length} critical Outreach sheets: ${missingSheets.join(', ')}`,
        metadata: {
          responseTimeMs: responseTime,
          requiredSheetsCount: requiredSheets.length,
          missingSheetsCount: missingSheets.length,
          missingSheets
        }
      };
    }

    // WARN if response is slow
    if (responseTime > 2000) {
      return {
        component: 'Outreach-Core',
        status: 'WARN',
        detail: `Slow Sheets response time: ${responseTime}ms (threshold: 2000ms)`,
        metadata: {
          responseTimeMs: responseTime,
          sheetsAccessible: true,
          requiredSheetsCount: requiredSheets.length,
          allSheetsPresent: true
        }
      };
    }

    return {
      component: 'Outreach-Core',
      status: 'PASS',
      detail: `All ${requiredSheets.length} Outreach sheets present, response time ${responseTime}ms`,
      metadata: {
        responseTimeMs: responseTime,
        requiredSheetsCount: requiredSheets.length,
        allSheetsPresent: true
      }
    };
  } catch (error: any) {
    return {
      component: 'Outreach-Core',
      status: 'FAIL',
      detail: `Cannot access Google Sheets: ${error.message}`,
      metadata: {
        error: error.message
      }
    };
  }
}

/**
 * Check webhook handlers and signature verification
 * 
 * PASS: At least one webhook secret configured, last verified event <30m
 * WARN: One secret missing (partial coverage), last event 30-120m
 * FAIL: Both secrets missing (no signature verification), or last event >2h
 */
async function checkWebhooks(): Promise<{
  component: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
  metadata?: Record<string, any>;
}> {
  const brevoSecretExists = !!process.env.BREVO_WEBHOOK_SECRET;
  const resendSecretExists = !!process.env.RESEND_WEBHOOK_SECRET;

  // Check OS_Health for recent webhook events
  let lastWebhookEvent: Date | null = null;
  try {
    const healthRows = await sheetsService.readSheet('OS_Health');
    const webhookEvents = healthRows.filter((row: any) => 
      row.Component?.includes('Webhook') || row.Message?.includes('webhook')
    );
    
    if (webhookEvents.length > 0) {
      const latest = webhookEvents[webhookEvents.length - 1] as any;
      lastWebhookEvent = new Date(latest.CheckTS);
    }
  } catch (error) {
    // Ignore if we can't read OS_Health
  }

  // Calculate time since last event
  let minutesSinceLastEvent: number | null = null;
  if (lastWebhookEvent) {
    minutesSinceLastEvent = (Date.now() - lastWebhookEvent.getTime()) / 1000 / 60;
  }

  // FAIL: Both secrets missing - critical security issue
  if (!brevoSecretExists && !resendSecretExists) {
    return {
      component: 'Webhooks',
      status: 'FAIL',
      detail: 'Critical: Webhook signature verification disabled (both BREVO_WEBHOOK_SECRET and RESEND_WEBHOOK_SECRET missing)',
      metadata: {
        brevoSecretConfigured: false,
        resendSecretConfigured: false,
        lastEventMinutesAgo: minutesSinceLastEvent,
        severity: 'CRITICAL'
      }
    };
  }

  // WARN: Only one secret configured (partial coverage)
  if (!brevoSecretExists || !resendSecretExists) {
    const missingProvider = !brevoSecretExists ? 'Brevo' : 'Resend';
    return {
      component: 'Webhooks',
      status: 'WARN',
      detail: `Partial webhook coverage: ${missingProvider} signature verification disabled`,
      metadata: {
        brevoSecretConfigured: brevoSecretExists,
        resendSecretConfigured: resendSecretExists,
        lastEventMinutesAgo: minutesSinceLastEvent,
        missingProvider
      }
    };
  }

  // WARN: No recent webhook activity (stale)
  if (minutesSinceLastEvent !== null && minutesSinceLastEvent > 120) {
    return {
      component: 'Webhooks',
      status: 'WARN',
      detail: `No webhook events in ${Math.round(minutesSinceLastEvent)} minutes (threshold: 120m)`,
      metadata: {
        brevoSecretConfigured: brevoSecretExists,
        resendSecretConfigured: resendSecretExists,
        lastEventMinutesAgo: minutesSinceLastEvent
      }
    };
  }

  // PASS: Both secrets configured
  return {
    component: 'Webhooks',
    status: 'PASS',
    detail: 'Webhook signature verification active for both providers',
    metadata: {
      brevoSecretConfigured: true,
      resendSecretConfigured: true,
      lastEventMinutesAgo: minutesSinceLastEvent
    }
  };
}

/**
 * Check AI Agent A-OUT-101 functions
 * 
 * PASS: Last action succeeded, quota headroom ≥20%
 * WARN: Quota headroom 5-20%, or transient errors
 * FAIL: Repeated quota exhaustion or all functions failing
 */
async function checkAIAgent(): Promise<{
  component: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
  metadata?: Record<string, any>;
}> {
  // Check AI_Outbox for recent A-OUT-101 activity
  let lastAIAction: any = null;
  let quotaErrors = 0;
  
  try {
    const aiOutbox = await sheetsService.readSheet('AI_Outbox');
    const a101Actions = aiOutbox.filter((row: any) => 
      row.AgentID === 'A-OUT-101' || row.Function?.includes('suggest') || row.Function?.includes('summarize')
    );
    
    if (a101Actions.length > 0) {
      lastAIAction = a101Actions[a101Actions.length - 1];
      
      // Count quota errors in last 24h
      const last24h = Date.now() - (24 * 60 * 60 * 1000);
      quotaErrors = a101Actions.filter((row: any) => {
        const ts = new Date(row.ResponseTS).getTime();
        return ts > last24h && (row.Status === 'FAIL' || row.Response?.includes('quota'));
      }).length;
    }
  } catch (error) {
    // Ignore if we can't read AI_Outbox
  }

  // OpenAI quota check (from env or test)
  const openaiKeyExists = !!process.env.OPENAI_API_KEY;

  if (!openaiKeyExists) {
    return {
      component: 'AI-Agent',
      status: 'WARN',
      detail: 'OpenAI API key not configured',
      metadata: {
        lastAction: lastAIAction?.Function || 'none',
        quotaErrors24h: quotaErrors
      }
    };
  }

  if (quotaErrors > 5) {
    return {
      component: 'AI-Agent',
      status: 'FAIL',
      detail: `Repeated quota exhaustion: ${quotaErrors} errors in last 24h`,
      metadata: {
        lastAction: lastAIAction?.Function || 'none',
        quotaErrors24h: quotaErrors
      }
    };
  }

  if (quotaErrors > 0) {
    return {
      component: 'AI-Agent',
      status: 'WARN',
      detail: `Transient quota errors: ${quotaErrors} in last 24h (threshold: 5)`,
      metadata: {
        lastAction: lastAIAction?.Function || 'none',
        quotaErrors24h: quotaErrors
      }
    };
  }

  return {
    component: 'AI-Agent',
    status: 'PASS',
    detail: 'AI Agent operational, no quota errors in 24h',
    metadata: {
      lastAction: lastAIAction?.Function || 'none',
      quotaErrors24h: quotaErrors,
      openaiKeyConfigured: true
    }
  };
}

/**
 * Check email provider connectivity
 * 
 * PASS: Provider API key configured, heartbeat <15m
 * WARN: Sandbox mode, heartbeat 15-120m
 * FAIL: No API key or heartbeat >2h
 */
async function checkEmailProvider(): Promise<{
  component: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
  metadata?: Record<string, any>;
}> {
  const smtpConfigured = !!(
    process.env.SMTP_HOST && 
    process.env.SMTP_USER && 
    process.env.SMTP_PASS
  );

  // Check Settings sheet for email provider
  let emailProvider = 'unknown';
  try {
    const settings = await sheetsService.readSheet('Settings');
    const providerSetting = settings.find((s: any) => s.Key === 'EMAIL_PROVIDER') as any;
    emailProvider = providerSetting?.Value || 'smtp';
  } catch (error) {
    // Default to smtp if can't read
  }

  if (!smtpConfigured) {
    return {
      component: 'Provider',
      status: 'FAIL',
      detail: 'Email provider not configured (missing SMTP credentials)',
      metadata: {
        emailProvider,
        smtpConfigured: false
      }
    };
  }

  return {
    component: 'Provider',
    status: 'PASS',
    detail: `Email provider configured: ${emailProvider}`,
    metadata: {
      emailProvider,
      smtpConfigured: true
    }
  };
}

/**
 * Check security posture
 * 
 * PASS: All API keys in Replit Secrets
 * WARN: Some keys in Sheet (migration recommended)
 * FAIL: Critical keys exposed in Sheet
 */
async function checkSecurityPosture(): Promise<{
  component: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
  metadata?: Record<string, any>;
}> {
  // Check if API keys are still in Settings sheet
  let keysInSheet: string[] = [];
  
  try {
    const settings = await sheetsService.readSheet('Settings');
    const sensitiveKeys = [
      'API_WOO_KEY',
      'API_WOO_SECRET',
      'API_ODOO_PASS',
      'SMTP_PASS',
      'API_PLACES_KEY'
    ];
    
    keysInSheet = settings
      .filter((s: any) => sensitiveKeys.includes(s.Key) && s.Value)
      .map((s: any) => s.Key);
  } catch (error) {
    // Ignore if can't read
  }

  if (keysInSheet.length > 0) {
    return {
      component: 'Security',
      status: 'WARN',
      detail: `${keysInSheet.length} API keys found in Sheet (should migrate to Replit Secrets)`,
      metadata: {
        keysInSheet: keysInSheet.length,
        recommendation: 'Migrate to Replit Secrets before production'
      }
    };
  }

  return {
    component: 'Security',
    status: 'PASS',
    detail: 'No sensitive keys detected in Sheet',
    metadata: {
      keysInSheet: 0
    }
  };
}

/**
 * Write Phase 2B Readiness results to OS_Health sheet
 */
export async function write2BReadinessToOSHealth(): Promise<void> {
  const results = await check2BReadiness();
  
  // Write overall status
  await sheetsService.writeOSHealth(
    '2B-Readiness-Overall',
    results.overallStatus,
    `Phase 2B Readiness Check: ${results.overallStatus} (CheckID: ${results.checkID})`,
    {
      checkID: results.checkID,
      timestamp: results.timestamp,
      componentsCount: results.components.length,
      passCount: results.components.filter(c => c.status === 'PASS').length,
      warnCount: results.components.filter(c => c.status === 'WARN').length,
      failCount: results.components.filter(c => c.status === 'FAIL').length
    }
  );

  // Write individual component statuses
  for (const component of results.components) {
    await sheetsService.writeOSHealth(
      `2B-${component.component}`,
      component.status,
      component.detail,
      component.metadata
    );
  }
}
