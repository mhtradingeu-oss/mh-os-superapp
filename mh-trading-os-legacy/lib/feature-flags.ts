export interface FeatureFlags {
  enableWooCommerce: boolean;
  enableOdoo: boolean;
  enableEmailNotifications: boolean;
  enableAIFeatures: boolean;
  enableDHLShipping: boolean;
  enableDriveIntegration: boolean;
  dryRunMode: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  const env = process.env.ENV || 'staging';
  const isDryRun = env === 'staging' || env === 'development';

  return {
    enableWooCommerce: !!process.env.API_WOO_BASE && !!process.env.API_WOO_KEY,
    enableOdoo: !!process.env.API_ODOO_BASE && !!process.env.API_ODOO_USER,
    enableEmailNotifications: !!process.env.SMTP_HOST && !!process.env.SMTP_USER,
    enableAIFeatures: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    enableDHLShipping: true,
    enableDriveIntegration: !!process.env.HM_DRIVE_ROOT_ID,
    dryRunMode: isDryRun,
  };
}

export function maskSecret(secret: string | undefined): string {
  if (!secret) return '(not set)';
  if (secret.length <= 8) return '***';
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
