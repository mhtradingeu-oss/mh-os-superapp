/**
 * AI Guardrails System
 * 
 * Prevents agents from making harmful or non-compliant changes
 * All guardrails must pass before draft creation
 */

import type { GoogleSheetsService } from './sheets';

export interface GuardrailResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
}

export interface PricingGuardrailCheck {
  sku: string;
  currentPrice: number;
  suggestedPrice: number;
  margin?: number;
  competitorPrices?: number[];
}

export interface OutreachGuardrailCheck {
  subject: string;
  body: string;
  recipientEmail: string;
  hasUnsubscribe: boolean;
}

/**
 * MAP (Minimum Advertised Price) Compliance Guardrail
 * Ensures suggested prices don't violate manufacturer agreements
 */
export async function checkMAPCompliance(
  sheetsService: GoogleSheetsService,
  checks: PricingGuardrailCheck[]
): Promise<GuardrailResult> {
  const violations: string[] = [];
  const warnings: string[] = [];

  try {
    const mapGuardrails = await sheetsService.readSheet<any>('MAP_Guardrails');
    const mapMap = new Map(mapGuardrails.map(m => [m.SKU, m.MinPrice]));

    for (const check of checks) {
      const minPrice = mapMap.get(check.sku);
      if (minPrice && check.suggestedPrice < minPrice) {
        violations.push(
          `SKU ${check.sku}: Suggested price €${check.suggestedPrice.toFixed(2)} ` +
          `is below MAP minimum €${minPrice.toFixed(2)}`
        );
      }

      // Warning if price drop is >20%
      const priceDropPct = ((check.currentPrice - check.suggestedPrice) / check.currentPrice) * 100;
      if (priceDropPct > 20) {
        warnings.push(
          `SKU ${check.sku}: Large price drop of ${priceDropPct.toFixed(1)}% ` +
          `(€${check.currentPrice} → €${check.suggestedPrice})`
        );
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings
    };
  } catch (error: any) {
    return {
      passed: false,
      violations: [`MAP check failed: ${error.message}`],
      warnings: []
    };
  }
}

/**
 * Margin Floor Guardrail
 * Ensures suggested prices maintain minimum profit margins
 */
export function checkMarginFloor(
  checks: PricingGuardrailCheck[],
  minMarginPct: number = 20
): GuardrailResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  for (const check of checks) {
    if (check.margin !== undefined && check.margin < minMarginPct) {
      violations.push(
        `SKU ${check.sku}: Margin ${check.margin.toFixed(1)}% is below ` +
        `minimum ${minMarginPct}%`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings
  };
}

/**
 * GDPR Compliance Guardrail for Outreach
 * Ensures emails have unsubscribe links and comply with privacy laws
 */
export function checkGDPRCompliance(
  checks: OutreachGuardrailCheck[]
): GuardrailResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  for (const check of checks) {
    // Must have unsubscribe mechanism
    if (!check.hasUnsubscribe) {
      violations.push(
        `Email to ${check.recipientEmail}: Missing unsubscribe link (GDPR violation)`
      );
    }

    // Check for spam trigger words
    const spamWords = ['free money', 'act now', 'limited time', '100% free'];
    const lowerBody = check.body.toLowerCase();
    const foundSpam = spamWords.filter(word => lowerBody.includes(word));
    
    if (foundSpam.length > 0) {
      warnings.push(
        `Email contains spam trigger words: ${foundSpam.join(', ')}`
      );
    }

    // Subject line length
    if (check.subject.length > 60) {
      warnings.push(
        `Subject line too long (${check.subject.length} chars, recommended <60)`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings
  };
}

/**
 * Brand Voice Guardrail
 * Ensures content matches brand tone and style
 */
export function checkBrandVoice(
  content: string,
  tone: 'professional' | 'friendly' | 'playful'
): GuardrailResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Prohibited words (unprofessional)
  const prohibitedWords = ['cheap', 'scam', 'fake', 'garbage'];
  const lowerContent = content.toLowerCase();
  const foundProhibited = prohibitedWords.filter(word => lowerContent.includes(word));

  if (foundProhibited.length > 0) {
    violations.push(
      `Content contains prohibited words: ${foundProhibited.join(', ')}`
    );
  }

  // Tone-specific checks
  if (tone === 'professional') {
    const informalWords = ['lol', 'omg', 'btw', 'gonna', 'wanna'];
    const foundInformal = informalWords.filter(word => lowerContent.includes(word));
    
    if (foundInformal.length > 0) {
      warnings.push(
        `Professional tone requested but found informal language: ${foundInformal.join(', ')}`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings
  };
}

/**
 * Budget Limit Guardrail
 * Prevents agents from exceeding spending limits (e.g., ads budget)
 */
export function checkBudgetLimit(
  proposedSpend: number,
  currentSpend: number,
  monthlyLimit: number
): GuardrailResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  const totalSpend = currentSpend + proposedSpend;

  if (totalSpend > monthlyLimit) {
    violations.push(
      `Proposed spend €${proposedSpend.toFixed(2)} would exceed monthly limit. ` +
      `Current: €${currentSpend.toFixed(2)}, Limit: €${monthlyLimit.toFixed(2)}`
    );
  } else if (totalSpend > monthlyLimit * 0.8) {
    warnings.push(
      `Budget approaching limit: ${((totalSpend / monthlyLimit) * 100).toFixed(1)}% used`
    );
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings
  };
}

/**
 * Master Guardrail Runner
 * Executes all relevant guardrails for an agent task
 */
export async function runGuardrails(
  agentId: string,
  task: string,
  data: any,
  sheetsService: GoogleSheetsService
): Promise<GuardrailResult> {
  const allViolations: string[] = [];
  const allWarnings: string[] = [];

  try {
    // Pricing agent guardrails
    if (agentId.startsWith('A-PRC-')) {
      if (task === 'suggest-price-changes' && data.checks) {
        const mapResult = await checkMAPCompliance(sheetsService, data.checks);
        allViolations.push(...mapResult.violations);
        allWarnings.push(...mapResult.warnings);

        const marginResult = checkMarginFloor(data.checks, data.minMarginPct || 20);
        allViolations.push(...marginResult.violations);
        allWarnings.push(...marginResult.warnings);
      }
    }

    // Outreach agent guardrails
    if (agentId.startsWith('A-OUT-') || agentId.startsWith('A-SOC-')) {
      if (data.emails) {
        const gdprResult = checkGDPRCompliance(data.emails);
        allViolations.push(...gdprResult.violations);
        allWarnings.push(...gdprResult.warnings);
      }

      if (data.content && data.tone) {
        const voiceResult = checkBrandVoice(data.content, data.tone);
        allViolations.push(...voiceResult.violations);
        allWarnings.push(...voiceResult.warnings);
      }
    }

    return {
      passed: allViolations.length === 0,
      violations: allViolations,
      warnings: allWarnings
    };
  } catch (error: any) {
    return {
      passed: false,
      violations: [`Guardrail check failed: ${error.message}`],
      warnings: []
    };
  }
}
