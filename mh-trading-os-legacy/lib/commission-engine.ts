/**
 * Commission Engine for MH Trading OS
 * Calculates sales rep commissions based on partner tiers and monthly targets
 * 
 * Commission Rates:
 * - Stand: 7%
 * - Dealer Basic: 5%
 * - Dealer Plus: 4%
 * - Distributor: 3%
 * 
 * Monthly Target Multiplier: 1.2x when target achieved (€50,000 or 20 deals)
 */

import { nanoid } from 'nanoid';

// Commission rates by tier
export const COMMISSION_RATES: Record<string, number> = {
  Stand: 0.07,      // 7%
  Basic: 0.05,      // 5% (Dealer Basic)
  Plus: 0.04,       // 4% (Dealer Plus)
  Distributor: 0.03 // 3%
};

// Monthly targets for multiplier eligibility
export const MONTHLY_TARGETS = {
  revenue: 50000,  // €50,000
  deals: 20        // 20 deals
};

// Target multiplier
export const TARGET_MULTIPLIER = 1.2;

/**
 * Calculate base commission for a sale
 */
export function calculateBaseCommission(
  netAmount: number,
  partnerTier: string
): number {
  const rate = COMMISSION_RATES[partnerTier] || COMMISSION_RATES['Basic'];
  return netAmount * rate;
}

/**
 * Calculate final commission with monthly target multiplier
 */
export function calculateFinalCommission(
  baseCommission: number,
  monthlyTargetMet: boolean
): number {
  return monthlyTargetMet 
    ? baseCommission * TARGET_MULTIPLIER 
    : baseCommission;
}

/**
 * Check if monthly target is met
 */
export function isMonthlyTargetMet(
  monthlyRevenue: number,
  monthlyDeals: number
): boolean {
  return monthlyRevenue >= MONTHLY_TARGETS.revenue 
      || monthlyDeals >= MONTHLY_TARGETS.deals;
}

/**
 * Calculate commission for a quote/order
 */
export interface CommissionCalculationInput {
  quoteId?: string;
  orderId?: string;
  partnerId: string;
  partnerTier: string;
  netAmount: number;
  repId: string;
  status: 'pending' | 'confirmed' | 'paid';
  monthlyRevenue?: number;
  monthlyDeals?: number;
}

export interface CommissionCalculationResult {
  ledgerId: string;
  timestamp: string;
  quoteId?: string;
  orderId?: string;
  partnerId: string;
  partnerTier: string;
  netAmount: number;
  commissionRate: number;
  baseCommission: number;
  monthlyTargetMet: boolean;
  multiplier: number;
  finalCommission: number;
  repId: string;
  status: string;
  paymentStage: 'none' | 'partial' | 'full';
  amountPayable: number;
}

export function calculateCommission(
  input: CommissionCalculationInput
): CommissionCalculationResult {
  // Calculate base commission
  const baseCommission = calculateBaseCommission(
    input.netAmount,
    input.partnerTier
  );

  // Check monthly target
  const monthlyTargetMet = isMonthlyTargetMet(
    input.monthlyRevenue || 0,
    input.monthlyDeals || 0
  );

  // Apply multiplier
  const multiplier = monthlyTargetMet ? TARGET_MULTIPLIER : 1.0;
  const finalCommission = baseCommission * multiplier;

  // Determine payment stage based on status
  let paymentStage: 'none' | 'partial' | 'full' = 'none';
  let amountPayable = 0;

  if (input.status === 'confirmed') {
    // 50% on confirmation
    paymentStage = 'partial';
    amountPayable = finalCommission * 0.5;
  } else if (input.status === 'paid') {
    // 100% on payment
    paymentStage = 'full';
    amountPayable = finalCommission;
  }

  return {
    ledgerId: nanoid(),
    timestamp: new Date().toISOString(),
    quoteId: input.quoteId,
    orderId: input.orderId,
    partnerId: input.partnerId,
    partnerTier: input.partnerTier,
    netAmount: input.netAmount,
    commissionRate: COMMISSION_RATES[input.partnerTier] || COMMISSION_RATES['Basic'],
    baseCommission,
    monthlyTargetMet,
    multiplier,
    finalCommission,
    repId: input.repId,
    status: input.status,
    paymentStage,
    amountPayable,
  };
}

/**
 * Calculate total monthly commissions for a rep
 */
export interface MonthlyCommissionSummary {
  repId: string;
  month: string;
  totalRevenue: number;
  totalDeals: number;
  baseCommissionTotal: number;
  targetMet: boolean;
  multiplierApplied: number;
  finalCommissionTotal: number;
  amountPaid: number;
  amountPending: number;
}

export function calculateMonthlyCommissionSummary(
  repId: string,
  month: string,
  commissions: CommissionCalculationResult[]
): MonthlyCommissionSummary {
  const totalRevenue = commissions.reduce((sum, c) => sum + c.netAmount, 0);
  const totalDeals = commissions.length;
  const baseCommissionTotal = commissions.reduce((sum, c) => sum + c.baseCommission, 0);
  
  const targetMet = isMonthlyTargetMet(totalRevenue, totalDeals);
  const multiplierApplied = targetMet ? TARGET_MULTIPLIER : 1.0;
  const finalCommissionTotal = baseCommissionTotal * multiplierApplied;

  const amountPaid = commissions
    .filter(c => c.paymentStage === 'full')
    .reduce((sum, c) => sum + c.amountPayable, 0);

  const amountPending = finalCommissionTotal - amountPaid;

  return {
    repId,
    month,
    totalRevenue,
    totalDeals,
    baseCommissionTotal,
    targetMet,
    multiplierApplied,
    finalCommissionTotal,
    amountPaid,
    amountPending,
  };
}

/**
 * Format commission for display
 */
export function formatCommission(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

/**
 * Get commission rate display
 */
export function getCommissionRateDisplay(tier: string): string {
  const rate = COMMISSION_RATES[tier] || COMMISSION_RATES['Basic'];
  return `${(rate * 100).toFixed(0)}%`;
}

/**
 * Validate commission calculation
 */
export function validateCommissionInput(
  input: CommissionCalculationInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.partnerId) {
    errors.push('Partner ID is required');
  }

  if (!input.partnerTier) {
    errors.push('Partner Tier is required');
  }

  if (input.netAmount <= 0) {
    errors.push('Net amount must be greater than 0');
  }

  if (!input.repId) {
    errors.push('Rep ID is required');
  }

  if (!['pending', 'confirmed', 'paid'].includes(input.status)) {
    errors.push('Status must be pending, confirmed, or paid');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
