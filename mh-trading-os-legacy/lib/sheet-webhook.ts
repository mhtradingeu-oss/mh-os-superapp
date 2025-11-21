/**
 * Sheet Webhook Handler
 * 
 * Handles incoming webhook notifications from Google Apps Script when
 * sheet data changes, enabling bidirectional sync.
 */

import crypto from 'crypto';

// Webhook secret for validating requests (set via environment variable)
const WEBHOOK_SECRET = process.env.SHEET_WEBHOOK_SECRET || 'default-dev-secret-change-in-production';

/**
 * Validates HMAC signature from Google Apps Script webhook
 * Returns false instead of throwing to prevent DoS
 */
export function validateWebhookSignature(
  payload: string,
  signature: string | undefined
): boolean {
  // Short-circuit if signature is missing
  if (!signature || typeof signature !== 'string') {
    return false;
  }
  
  // Validate signature length (SHA256 hex = 64 chars)
  if (signature.length !== 64) {
    return false;
  }
  
  try {
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    // Safe comparison (both are now guaranteed to be same length)
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    // Catch any crypto errors and return false instead of throwing
    console.error('Webhook signature validation error:', error);
    return false;
  }
}

/**
 * Webhook payload structure from Google Apps Script
 */
export interface SheetWebhookPayload {
  sheetName: string;
  changeType: 'INSERT' | 'UPDATE' | 'DELETE' | 'EDIT';
  range?: string;
  timestamp: string;
  rowsAffected?: number;
  user?: string;
}

/**
 * Processes webhook notification and determines cache invalidation strategy
 */
export function processSheetChange(payload: SheetWebhookPayload): {
  cacheKeysToInvalidate: string[];
  shouldReprice: boolean;
  shouldNotify: boolean;
} {
  const cacheKeysToInvalidate: string[] = [];
  let shouldReprice = false;
  let shouldNotify = true;
  
  // Map sheet names to cache keys that need invalidation
  const sheetToCacheMap: Record<string, string[]> = {
    // Pricing domain
    'FinalPriceList': ['/api/pricing/products', '/api/catalog/products'],
    'Pricing_Params': ['/api/pricing/params'],
    'PartnerTiers': ['/api/partners/tiers'],
    'AmazonSizeTiers': ['/api/pricing/amazon-tiers'],
    'ShippingMatrixDHL': ['/api/shipping/matrix'],
    'DHLSurcharge': ['/api/shipping/surcharges'],
    'MAP_Guardrails': ['/api/pricing/map-guardrails'],
    'Pricing_Suggestions': ['/api/pricing/suggestions'],
    
    // Sales & CRM
    'Partners': ['/api/partners'],
    'Quotes': ['/api/sales/quotes'],
    'QuoteLines': ['/api/sales/quote-lines'],
    'Orders': ['/api/sales/orders', '/api/dashboard/metrics', '/api/reports/revenue'],
    'OrderLines': ['/api/sales/order-lines'],
    'Invoices': ['/api/sales/invoices'],
    
    // Commission & Loyalty
    'Commission_Rules': ['/api/sales/commissions/rules'],
    'Commission_Ledger': ['/api/sales/commissions/ledger'],
    'Loyalty_Ledger': ['/api/loyalty/ledger'],
    
    // Stand Management
    'Stands': ['/api/stands'],
    'Stand_Inventory': ['/api/stands/inventory'],
    'Stand_Visits': ['/api/stands/visits'],
    
    // Territory & CRM
    'CRM_Leads': ['/api/growth/leads'],
    'Territories': ['/api/territories'],
    'Assignment_Rules': ['/api/territories/rules'],
    
    // Operations
    'OS_Health': ['/api/admin/health'],
    'OS_Logs': ['/api/admin/logs'],
    'Agent_Profiles': ['/api/ai/agents'],
    'AI_Jobs': ['/api/ai/jobs'],
  };
  
  // Get cache keys for this sheet
  const keys = sheetToCacheMap[payload.sheetName] || [];
  cacheKeysToInvalidate.push(...keys);
  
  // Determine if we should trigger auto-reprice
  // Only reprice when pricing-critical data changes
  const sheetsRequiringReprice = [
    'Pricing_Params',
    'AmazonSizeTiers',
    'ShippingMatrixDHL',
    'DHLSurcharge',
  ];
  
  if (sheetsRequiringReprice.includes(payload.sheetName)) {
    shouldReprice = true;
  }
  
  // Some sheets don't need client notification (logs, health checks)
  const silentSheets = ['OS_Logs', 'OS_Health'];
  if (silentSheets.includes(payload.sheetName)) {
    shouldNotify = false;
  }
  
  return {
    cacheKeysToInvalidate,
    shouldReprice,
    shouldNotify,
  };
}

/**
 * Validates webhook payload structure
 */
export function isValidWebhookPayload(payload: any): payload is SheetWebhookPayload {
  return (
    typeof payload === 'object' &&
    typeof payload.sheetName === 'string' &&
    typeof payload.changeType === 'string' &&
    typeof payload.timestamp === 'string' &&
    ['INSERT', 'UPDATE', 'DELETE', 'EDIT'].includes(payload.changeType)
  );
}
