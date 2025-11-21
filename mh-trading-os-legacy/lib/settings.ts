import { sheetsService } from './sheets';

// Critical settings that must be validated
const CRITICAL_SETTINGS = [
  'HM_CURRENCY',
  'VAT_Default_Pct',
  'HM_DRIVE_ROOT_ID',
  'HM_STAND_QR_BASE',
  'EMAIL_PROVIDER',
  'AI_Default_Model',
] as const;

// Sensitive keys that must ONLY come from Replit Secrets (never from Sheet)
const SECRET_KEYS = [
  'API_PLACES_KEY',
  'API_WOO_KEY',
  'API_WOO_SECRET',
  'API_WOO_BASE',
  'API_ODOO_BASE',
  'API_ODOO_DB',
  'API_ODOO_USER',
  'API_ODOO_PASS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'AI_INTEGRATIONS_OPENAI_API_KEY',
  'AI_INTEGRATIONS_OPENAI_BASE_URL',
  'SESSION_SECRET',
] as const;

export interface SettingsStatus {
  key: string;
  status: 'ok' | 'missing' | 'secret' | 'warning';
  source: 'sheet' | 'env' | 'default' | 'none';
  value?: string; // Only for non-secret values
  warning?: string;
}

export interface HydratedConfig {
  // Core settings
  HM_CURRENCY: string;
  VAT_Default_Pct: number;
  HM_DRIVE_ROOT_ID: string;
  HM_STAND_QR_BASE: string;
  EMAIL_PROVIDER: string;
  AI_Default_Model: string;
  
  // Pricing settings
  GUARDRAIL_ENFORCE_MAP: boolean;
  RND_WEB_STEP: number;
  RND_SALON_STEP: number;
  PRICE_STRATEGY: string;
  
  // Status tracking
  settingsStatus: SettingsStatus[];
}

/**
 * Hydrate application settings from Google Sheets + Replit Secrets
 * - Reads Settings!A:C from Sheet
 * - Merges with process.env (Secrets take priority for sensitive keys)
 * - Never writes secrets to Sheet
 * - Logs warnings for misplaced secrets
 */
export async function hydrateSettings(): Promise<HydratedConfig> {
  const settingsStatus: SettingsStatus[] = [];
  
  // 1. Read Settings from Sheet
  let sheetSettings: Record<string, string> = {};
  try {
    const settings = await sheetsService.getSettings();
    sheetSettings = settings.reduce((acc, s) => {
      acc[s.Key] = s.Value || '';
      return acc;
    }, {} as Record<string, string>);
  } catch (error: any) {
    await sheetsService.logToSheet('ERROR', 'Settings', `Failed to read settings: ${error.message}`);
  }

  // 2. Check for secret leaks in Sheet (security audit)
  for (const secretKey of SECRET_KEYS) {
    if (sheetSettings[secretKey]) {
      const warning = `SECURITY: "${secretKey}" found in Sheet. Move to Replit Secrets and remove from Sheet.`;
      settingsStatus.push({
        key: secretKey,
        status: 'warning',
        source: 'sheet',
        warning,
      });
      await sheetsService.logToSheet('WARN', 'Settings', warning);
    }
  }

  // 3. Helper to get setting value (Secrets > Sheet > Default)
  const getSetting = (
    key: string,
    defaultValue: string = '',
    isSecret: boolean = false
  ): { value: string; source: 'sheet' | 'env' | 'default' } => {
    // For secrets, ONLY check process.env
    if (isSecret || SECRET_KEYS.includes(key as any)) {
      const envValue = process.env[key];
      if (envValue) {
        return { value: envValue, source: 'env' };
      }
      return { value: defaultValue, source: 'default' };
    }

    // For non-secrets: Env > Sheet > Default
    const envValue = process.env[key];
    if (envValue) {
      return { value: envValue, source: 'env' };
    }
    
    const sheetValue = sheetSettings[key];
    if (sheetValue) {
      return { value: sheetValue, source: 'sheet' };
    }
    
    return { value: defaultValue, source: 'default' };
  };

  // 4. Hydrate critical settings
  const currency = getSetting('HM_CURRENCY', 'EUR');
  settingsStatus.push({
    key: 'HM_CURRENCY',
    status: currency.value ? 'ok' : 'missing',
    source: currency.source,
    value: currency.value,
  });

  const vatPct = getSetting('VAT_Default_Pct', '19');
  settingsStatus.push({
    key: 'VAT_Default_Pct',
    status: vatPct.value ? 'ok' : 'missing',
    source: vatPct.source,
    value: vatPct.value,
  });

  const driveRootId = getSetting('HM_DRIVE_ROOT_ID', '');
  settingsStatus.push({
    key: 'HM_DRIVE_ROOT_ID',
    status: driveRootId.value ? 'ok' : 'missing',
    source: driveRootId.source,
    value: driveRootId.value ? 'configured' : '',
    warning: !driveRootId.value ? 'Google Drive not configured (optional)' : undefined,
  });

  const standQrBase = getSetting('HM_STAND_QR_BASE', '');
  settingsStatus.push({
    key: 'HM_STAND_QR_BASE',
    status: standQrBase.value ? 'ok' : 'missing',
    source: standQrBase.source,
    value: standQrBase.value,
    warning: !standQrBase.value ? 'Stand QR base URL not configured' : undefined,
  });

  const emailProvider = getSetting('EMAIL_PROVIDER', 'smtp');
  settingsStatus.push({
    key: 'EMAIL_PROVIDER',
    status: emailProvider.value ? 'ok' : 'missing',
    source: emailProvider.source,
    value: emailProvider.value,
  });

  const aiModel = getSetting('AI_Default_Model', 'gpt-4o');
  settingsStatus.push({
    key: 'AI_Default_Model',
    status: aiModel.value ? 'ok' : 'missing',
    source: aiModel.source,
    value: aiModel.value,
  });

  // 5. Hydrate secret settings (from Secrets only)
  const apiPlacesKey = getSetting('API_PLACES_KEY', '', true);
  settingsStatus.push({
    key: 'API_PLACES_KEY',
    status: apiPlacesKey.value ? 'secret' : 'missing',
    source: apiPlacesKey.source,
    warning: !apiPlacesKey.value ? 'Google Places API not configured (optional for Phase 2)' : undefined,
  });

  // 6. Hydrate pricing settings
  const guardrailEnforce = getSetting('GUARDRAIL_ENFORCE_MAP', 'true');
  const rndWebStep = getSetting('RND_WEB_STEP', '0.05');
  const rndSalonStep = getSetting('RND_SALON_STEP', '0.10');
  const priceStrategy = getSetting('PRICE_STRATEGY', 'auto');

  settingsStatus.push(
    {
      key: 'GUARDRAIL_ENFORCE_MAP',
      status: 'ok',
      source: guardrailEnforce.source,
      value: guardrailEnforce.value,
    },
    {
      key: 'RND_WEB_STEP',
      status: 'ok',
      source: rndWebStep.source,
      value: rndWebStep.value,
    },
    {
      key: 'RND_SALON_STEP',
      status: 'ok',
      source: rndSalonStep.source,
      value: rndSalonStep.value,
    },
    {
      key: 'PRICE_STRATEGY',
      status: 'ok',
      source: priceStrategy.source,
      value: priceStrategy.value,
    }
  );

  // 7. Log hydration summary
  const okCount = settingsStatus.filter(s => s.status === 'ok').length;
  const missingCount = settingsStatus.filter(s => s.status === 'missing').length;
  const warningCount = settingsStatus.filter(s => s.status === 'warning').length;
  const secretCount = settingsStatus.filter(s => s.status === 'secret').length;

  const summary = `Settings hydrated: ${okCount} ok, ${missingCount} missing, ${warningCount} warnings, ${secretCount} secrets`;
  await sheetsService.logToSheet('INFO', 'Settings', summary);

  // Log warnings for missing critical settings
  for (const status of settingsStatus) {
    if (status.status === 'missing' && !status.warning?.includes('optional')) {
      await sheetsService.logToSheet('WARN', 'Settings', `Missing critical setting: ${status.key}`);
    }
  }

  return {
    HM_CURRENCY: currency.value,
    VAT_Default_Pct: parseFloat(vatPct.value) || 19,
    HM_DRIVE_ROOT_ID: driveRootId.value,
    HM_STAND_QR_BASE: standQrBase.value,
    EMAIL_PROVIDER: emailProvider.value,
    AI_Default_Model: aiModel.value,
    GUARDRAIL_ENFORCE_MAP: guardrailEnforce.value === 'true' || guardrailEnforce.value === 'TRUE',
    RND_WEB_STEP: parseFloat(rndWebStep.value) || 0.05,
    RND_SALON_STEP: parseFloat(rndSalonStep.value) || 0.10,
    PRICE_STRATEGY: priceStrategy.value,
    settingsStatus,
  };
}

/**
 * Validate that no secrets are in the Sheet (security check)
 */
export async function validateNoSecretsInSheet(): Promise<{ ok: boolean; violations: string[] }> {
  const violations: string[] = [];
  
  try {
    const settings = await sheetsService.getSettings();
    const sheetKeys = new Set(settings.map(s => s.Key));
    
    for (const secretKey of SECRET_KEYS) {
      if (sheetKeys.has(secretKey)) {
        violations.push(secretKey);
      }
    }
  } catch (error) {
    // If we can't read settings, assume ok (don't block)
    return { ok: true, violations: [] };
  }
  
  return { ok: violations.length === 0, violations };
}
