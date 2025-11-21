/**
 * Pricing Law v2 Engine ("القانون الشامل للمحرّك")
 * 
 * Comprehensive pricing system implementing:
 * - 8-component FullCost breakdown
 * - Grundpreis (PAngV) compliance for € per L/kg
 * - Channel-specific costs (Amazon FBA, Stripe, DHL, Returns, Loyalty, Box costs)
 * - ≥45% margin guardrail enforcement
 * - MAP enforcement with competitor tracking
 * - Line targets & floor multipliers
 * - B2B role discounts with quantity tiers and caps
 * 
 * @module pricing-law
 */

import type {
  FinalPriceList,
  Channel,
  AmazonSizeTier,
  ShippingMatrixDHL,
  DHLSurcharge,
  QuantityDiscount,
  DiscountCap,
  OrderDiscount,
  PricingLineTarget
} from '@shared/schema';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Context for Pricing Law v2 calculations
 * Contains all configuration data loaded from Google Sheets
 */
export interface PricingLawContext {
  channels: Channel[];
  amazonTiers: AmazonSizeTier[];
  shippingMatrix: ShippingMatrixDHL[];
  dhlSurcharges: DHLSurcharge[];
  quantityDiscounts: QuantityDiscount[];
  discountCaps: DiscountCap[];
  orderDiscounts: OrderDiscount[];
  lineTargets: PricingLineTarget[];
}

/**
 * 8-component FullCost breakdown
 * All costs are per-unit in EUR
 */
export interface FullCostBreakdown {
  /** Base product cost from factory (ex-works) */
  factoryCost: number;
  /** Packaging materials cost per unit */
  packagingCost: number;
  /** Inbound shipping cost per unit (sea/air freight) */
  shippingInbound: number;
  /** EPR/LUCID extended producer responsibility fee per unit */
  eprLucid: number;
  /** GS1 barcode registration/licensing fee per unit */
  gs1: number;
  /** Retail packaging/labeling cost per unit */
  retailPackaging: number;
  /** Quality control & product inspection fee per unit */
  qcPif: number;
  /** Operational overhead per unit (warehousing, admin) */
  operations: number;
  /** Marketing/promotion allocation per unit */
  marketing: number;
  /** Total FullCost in EUR */
  fullCostEUR: number;
}

/**
 * Grundpreis (PAngV - Price Indication Ordinance) calculation
 * Required for products sold by weight/volume in Germany
 */
export interface GrundpreisResult {
  /** Base price (Grundpreis) per reference unit */
  grundpreis: number;
  /** Reference unit (e.g., "L", "kg", "100g") */
  grundpreisUnit: string;
  /** Whether PAngV applies (content quantity must be specified) */
  pangvApplies: boolean;
  /** Validation result */
  isValid: boolean;
  /** Validation error if any */
  validationError?: string;
}

/**
 * Channel-specific cost breakdown for a single SKU
 */
export interface ChannelCostBreakdown {
  channelId: string;
  channelName: string;
  /** Payment processing fee (Stripe 1.5% + €0.25, etc.) */
  paymentFee: number;
  /** Platform referral fee (Amazon 8-15%, etc.) */
  referralFee: number;
  /** FBA fulfillment fee (if Amazon_FBA) */
  fbaFee: number;
  /** DHL shipping cost (if OwnStore/Amazon_FBM) */
  dhlShipping: number;
  /** DHL surcharges (LKW_CO2, Peak, Energy) */
  dhlSurcharges: number;
  /** Box/packaging cost */
  boxCost: number;
  /** Returns provision (channel-specific %) */
  returnsCost: number;
  /** Loyalty accounting provision */
  loyaltyCost: number;
  /** Total channel cost per unit */
  totalChannelCost: number;
}

/**
 * Post-channel margin check result
 */
export interface GuardrailResult {
  /** Net revenue after all channel costs */
  netRevenue: number;
  /** Post-channel margin percentage */
  postChannelMarginPct: number;
  /** Whether margin meets ≥45% guardrail */
  guardrailOK: boolean;
  /** Mitigation suggestion if guardrail fails */
  mitigationSuggestion?: string;
}

// ============================================================================
// FULLCOST CALCULATION (Task 2.1)
// ============================================================================

/**
 * Calculate comprehensive FullCost using 8 cost components
 * 
 * @param product - FinalPriceList row with v2 cost fields
 * @returns FullCostBreakdown with all components and total
 * 
 * @example
 * ```ts
 * const product = {
 *   SKU: 'HM-BC-K-50-001',
 *   Factory_Cost_EUR: 8.50,
 *   Packaging_Cost_EUR: 0.80,
 *   Shipping_Inbound_per_unit: 1.20,
 *   EPR_LUCID_per_unit: 0.15,
 *   GS1_per_unit: 0.05,
 *   Retail_Packaging_per_unit: 0.50,
 *   QC_PIF_per_unit: 0.30,
 *   Operations_per_unit: 1.50,
 *   Marketing_per_unit: 0.80
 * };
 * 
 * const fullCost = calculateFullCost(product);
 * // fullCost.fullCostEUR = 13.80
 * ```
 */
export function calculateFullCost(product: FinalPriceList): FullCostBreakdown {
  // Use nullish coalescing (??) to preserve explicit zero values
  const factoryCost = product.Factory_Cost_EUR ?? 0;
  const packagingCost = product.Packaging_Cost_EUR ?? 0;
  const shippingInbound = product.Shipping_Inbound_per_unit ?? 0;
  const eprLucid = product.EPR_LUCID_per_unit ?? 0;
  const gs1 = product.GS1_per_unit ?? 0;
  const retailPackaging = product.Retail_Packaging_per_unit ?? 0;
  const qcPif = product.QC_PIF_per_unit ?? 0;
  const operations = product.Operations_per_unit ?? 0;
  const marketing = product.Marketing_per_unit ?? 0;

  const fullCostEUR = 
    factoryCost +
    packagingCost +
    shippingInbound +
    eprLucid +
    gs1 +
    retailPackaging +
    qcPif +
    operations +
    marketing;

  return {
    factoryCost,
    packagingCost,
    shippingInbound,
    eprLucid,
    gs1,
    retailPackaging,
    qcPif,
    operations,
    marketing,
    fullCostEUR: Math.round(fullCostEUR * 100) / 100
  };
}

/**
 * Validate that a product has all required v2 FullCost fields populated
 * 
 * @param product - FinalPriceList row to validate
 * @returns Array of missing field names (empty if all present)
 */
export function validateFullCostFields(product: FinalPriceList): string[] {
  const missingFields: string[] = [];
  
  const requiredFields: (keyof FinalPriceList)[] = [
    'Factory_Cost_EUR',
    'Packaging_Cost_EUR',
    'Shipping_Inbound_per_unit',
    'EPR_LUCID_per_unit',
    'GS1_per_unit',
    'Retail_Packaging_per_unit',
    'QC_PIF_per_unit',
    'Operations_per_unit',
    'Marketing_per_unit'
  ];
  
  for (const field of requiredFields) {
    if (product[field] === undefined || product[field] === null) {
      missingFields.push(field);
    }
  }
  
  return missingFields;
}

/**
 * Generate FullCost with conservative fallback defaults for missing fields
 * Used during data migration when not all fields are populated
 * 
 * @param product - FinalPriceList row (may have missing fields)
 * @param legacyCOGS - Fallback COGS_EUR from v1 system
 * @returns FullCostBreakdown with defaults applied
 */
export function calculateFullCostWithDefaults(
  product: FinalPriceList,
  legacyCOGS?: number
): FullCostBreakdown {
  // If all v2 fields are present, use them
  const missingFields = validateFullCostFields(product);
  if (missingFields.length === 0) {
    return calculateFullCost(product);
  }

  // Otherwise, estimate from legacy COGS
  const baseCOGS = legacyCOGS ?? product.COGS_EUR ?? 0;
  
  // Conservative allocation (total should approximate baseCOGS + 20% overhead)
  // Use nullish coalescing (??) to preserve explicit zero values
  const factoryCost = product.Factory_Cost_EUR ?? baseCOGS * 0.70;
  const packagingCost = product.Packaging_Cost_EUR ?? baseCOGS * 0.08;
  const shippingInbound = product.Shipping_Inbound_per_unit ?? baseCOGS * 0.10;
  const eprLucid = product.EPR_LUCID_per_unit ?? baseCOGS * 0.02;
  const gs1 = product.GS1_per_unit ?? baseCOGS * 0.01;
  const retailPackaging = product.Retail_Packaging_per_unit ?? baseCOGS * 0.05;
  const qcPif = product.QC_PIF_per_unit ?? baseCOGS * 0.03;
  const operations = product.Operations_per_unit ?? baseCOGS * 0.12;
  const marketing = product.Marketing_per_unit ?? baseCOGS * 0.09;

  const fullCostEUR = 
    factoryCost +
    packagingCost +
    shippingInbound +
    eprLucid +
    gs1 +
    retailPackaging +
    qcPif +
    operations +
    marketing;

  return {
    factoryCost,
    packagingCost,
    shippingInbound,
    eprLucid,
    gs1,
    retailPackaging,
    qcPif,
    operations,
    marketing,
    fullCostEUR: Math.round(fullCostEUR * 100) / 100
  };
}

// ============================================================================
// GRUNDPREIS (PAngV) CALCULATION (Task 2.2) - Stubs for now
// ============================================================================

/**
 * Calculate Grundpreis (€ per reference unit) per PAngV requirements
 * 
 * PAngV (Preisangabenverordnung) requires displaying base price per standard unit:
 * - Liquids: € per liter (L)
 * - Solids: € per kilogram (kg)
 * 
 * @param uvp - Unit sales price in EUR
 * @param product - Product with content information
 * @returns Grundpreis calculation result with validation
 * 
 * @example
 * // 50ml beard oil at €32.99
 * const result = calculateGrundpreis(32.99, { Content_ml: 50, Grundpreis_Unit: 'L' });
 * // result.grundpreis = 659.80 (€659.80/L)
 * 
 * @example
 * // 100g cream at €12.53
 * const result = calculateGrundpreis(12.53, { Weight_g: 100, Grundpreis_Unit: 'kg' });
 * // result.grundpreis = 125.30 (€125.30/kg)
 */
export function calculateGrundpreis(
  uvp: number,
  product: Pick<FinalPriceList, 'Content_ml' | 'Weight_g' | 'Grundpreis_Unit'>
): GrundpreisResult {
  // Validation: UVP must be positive
  if (uvp <= 0) {
    return {
      grundpreis: 0,
      grundpreisUnit: '',
      pangvApplies: false,
      isValid: false,
      validationError: 'UVP must be greater than 0'
    };
  }

  // Determine which unit to use
  const unit = product.Grundpreis_Unit;
  
  // If no unit specified or unsupported unit, PAngV doesn't apply
  // (e.g., products sold per piece, pack, or future units like '100g')
  if (!unit || (unit !== 'L' && unit !== 'kg')) {
    return {
      grundpreis: 0,
      grundpreisUnit: unit ?? '',
      pangvApplies: false,
      isValid: true // Valid to not require Grundpreis for non-PAngV products
    };
  }

  // Calculate based on unit type
  if (unit === 'L') {
    // Liquid products: require Content_ml
    const contentMl = product.Content_ml ?? 0;
    
    if (contentMl <= 0) {
      return {
        grundpreis: 0,
        grundpreisUnit: 'L',
        pangvApplies: true,
        isValid: false,
        validationError: 'Content_ml must be specified and > 0 for Grundpreis_Unit=L'
      };
    }

    // Convert ml to L and calculate price per liter
    const contentL = contentMl / 1000;
    const grundpreis = Math.round((uvp / contentL) * 100) / 100;

    return {
      grundpreis,
      grundpreisUnit: 'L',
      pangvApplies: true,
      isValid: true
    };
  } 
  else if (unit === 'kg') {
    // Solid products: require Weight_g
    const weightG = product.Weight_g ?? 0;
    
    if (weightG <= 0) {
      return {
        grundpreis: 0,
        grundpreisUnit: 'kg',
        pangvApplies: true,
        isValid: false,
        validationError: 'Weight_g must be specified and > 0 for Grundpreis_Unit=kg'
      };
    }

    // Convert g to kg and calculate price per kilogram
    const weightKg = weightG / 1000;
    const grundpreis = Math.round((uvp / weightKg) * 100) / 100;

    return {
      grundpreis,
      grundpreisUnit: 'kg',
      pangvApplies: true,
      isValid: true
    };
  }

  // This should never be reached due to early return above
  // but TypeScript requires exhaustive handling
  return {
    grundpreis: 0,
    grundpreisUnit: unit,
    pangvApplies: false,
    isValid: true
  };
}

/**
 * Calculate UVP (recommended retail price) from FullCost and target margin
 * 
 * UVP calculation with proper rounding to German pricing conventions:
 * - Round to nearest €0.01 for precision
 * - Optionally round to €X.99 or €X.95 ending (common retail practice)
 * 
 * @param fullCost - Total landed cost per unit in EUR
 * @param targetMarginPct - Target gross margin percentage (e.g., 50 for 50%)
 * @param roundingStrategy - 'precise' | 'x99' | 'x95' (default: 'precise')
 * @returns Calculated UVP in EUR
 * 
 * @example
 * const uvp = calculateUVP(13.80, 50); // €27.60 (50% margin)
 * const uvp99 = calculateUVP(13.80, 50, 'x99'); // €27.99 (psychological pricing)
 */
export function calculateUVP(
  fullCost: number,
  targetMarginPct: number,
  roundingStrategy: 'precise' | 'x99' | 'x95' = 'precise'
): number {
  if (fullCost < 0 || targetMarginPct < 0 || targetMarginPct >= 100) {
    return 0;
  }

  // UVP = FullCost / (1 - MarginPct/100)
  // e.g., €13.80 at 50% margin = €13.80 / 0.5 = €27.60
  const marginMultiplier = 1 - (targetMarginPct / 100);
  const rawUVP = fullCost / marginMultiplier;

  // Apply rounding strategy
  switch (roundingStrategy) {
    case 'x99':
      // Round to nearest €X.99 (e.g., 27.60 → 27.99)
      return Math.floor(rawUVP) + 0.99;
    
    case 'x95':
      // Round to nearest €X.95 (e.g., 27.60 → 27.95)
      return Math.floor(rawUVP) + 0.95;
    
    case 'precise':
    default:
      // Round to nearest cent (2 decimal places)
      return Math.round(rawUVP * 100) / 100;
  }
}

// ============================================================================
// CHANNEL COSTS CALCULATION (Task 2.3) - Stubs for now
// ============================================================================

/**
 * Calculate channel-specific costs for a given channel and SKU
 * 
 * Includes all channel-specific fees:
 * - Payment processing (Stripe/PayPal/Amazon)
 * - Platform referral fees (Amazon 8-15%)
 * - FBA fulfillment (if Amazon_FBA)
 * - DHL shipping (if OwnStore/Amazon_FBM)
 * - DHL surcharges (LKW_CO2, Peak, Energy)
 * - Returns provision (channel-specific %)
 * - Loyalty accounting provision
 * - Box/packaging costs
 * 
 * @param product - Product with specs (Weight_g, Amazon_TierKey, etc.)
 * @param channelId - Channel identifier ("OwnStore", "Amazon_FBA", "Amazon_FBM")
 * @param uvp - Unit sales price in EUR
 * @param ctx - Pricing context with channel configs, Amazon tiers, DHL rates
 * @returns Channel cost breakdown
 */
export function calculateChannelCosts(
  product: FinalPriceList,
  channelId: string,
  uvp: number,
  ctx: PricingLawContext
): ChannelCostBreakdown {
  // Find channel config
  const channel = ctx.channels.find(c => c.ChannelID === channelId);
  
  if (!channel) {
    return {
      channelId,
      channelName: 'Unknown',
      paymentFee: 0,
      referralFee: 0,
      fbaFee: 0,
      dhlShipping: 0,
      dhlSurcharges: 0,
      boxCost: 0,
      returnsCost: 0,
      loyaltyCost: 0,
      totalChannelCost: 0
    };
  }

  let paymentFee = 0;
  let referralFee = 0;
  let fbaFee = 0;
  let dhlShipping = 0;
  let dhlSurcharges = 0;
  let boxCost = 0;

  // 1. Payment processing fees (percentage and/or fixed)
  // Handle percentage and fixed components independently
  const paymentFeePct = channel.Payment_Fee_Pct ?? 0;
  const paymentFeeFixed = channel.Payment_Fee_Fixed_EUR ?? 0;
  paymentFee = (uvp * (paymentFeePct / 100)) + paymentFeeFixed;

  // 2. Amazon referral fees (tiered: 8% for ≤€10, 15% for >€10)
  if (channelId.startsWith('Amazon_')) {
    const referralPctLow = channel.Amazon_Referral_Pct_Low ?? 8;
    const referralPctHigh = channel.Amazon_Referral_Pct_High ?? 15;
    const referralMin = channel.Amazon_Referral_Min_EUR ?? 0.30;
    
    const referralPct = uvp <= 10 ? referralPctLow : referralPctHigh;
    referralFee = Math.max(uvp * (referralPct / 100), referralMin);
  }

  // 3. FBA fulfillment fees (if Amazon_FBA)
  if (channelId === 'Amazon_FBA' && product.Amazon_TierKey) {
    const tier = ctx.amazonTiers.find(t => t.TierKey === product.Amazon_TierKey);
    if (tier) {
      fbaFee = tier.FBA_Fee_EUR + (tier.FBA_Surcharge_2025_EUR ?? 0);
    }
  }

  // 4. DHL shipping (if OwnStore or Amazon_FBM)
  if ((channelId === 'OwnStore' || channelId === 'Amazon_FBM') && product.Weight_g) {
    // Find matching weight band (assuming Zone "DE_1" as default)
    const zone = 'DE_1';
    const shippingRate = ctx.shippingMatrix.find(
      rate => rate.Zone === zone && 
              product.Weight_g! >= rate.Weight_Min_g && 
              product.Weight_g! <= rate.Weight_Max_g
    );
    
    if (shippingRate) {
      dhlShipping = shippingRate.Base_Rate_EUR;
      
      // 5. DHL surcharges (apply to DHL shipments)
      const lkwSurcharge = ctx.dhlSurcharges.find(s => s.SurchargeKey === 'LKW_CO2');
      const peakSurcharge = ctx.dhlSurcharges.find(s => s.SurchargeKey === 'Peak');
      const energySurcharge = ctx.dhlSurcharges.find(s => s.SurchargeKey === 'Energy_Surcharge_Var');
      
      // Sum up surcharges (simplified - assumes fixed amounts)
      if (lkwSurcharge?.Amount_EUR) dhlSurcharges += lkwSurcharge.Amount_EUR;
      if (peakSurcharge?.Amount_EUR) dhlSurcharges += peakSurcharge.Amount_EUR;
      if (energySurcharge?.Amount_EUR) dhlSurcharges += energySurcharge.Amount_EUR;
    }
  }

  // 6. Box/packaging cost (lookup from Boxes table if needed)
  // For now, use a simple default of €0.50 for shipped items
  if (channelId === 'OwnStore' || channelId === 'Amazon_FBM') {
    boxCost = 0.50;
  }

  // 7. Returns provision (channel-specific percentage of UVP)
  const returnsPct = channel.Returns_Pct ?? 0;
  const returnsCost = Math.round(uvp * (returnsPct / 100) * 100) / 100;

  // 8. Loyalty accounting provision (assume 2% for OwnStore)
  const loyaltyPct = channelId === 'OwnStore' ? 2 : 0;
  const loyaltyCost = Math.round(uvp * (loyaltyPct / 100) * 100) / 100;

  // Total channel costs
  const totalChannelCost = Math.round((
    paymentFee +
    referralFee +
    fbaFee +
    dhlShipping +
    dhlSurcharges +
    boxCost +
    returnsCost +
    loyaltyCost
  ) * 100) / 100;

  return {
    channelId,
    channelName: channel.ChannelName,
    paymentFee: Math.round(paymentFee * 100) / 100,
    referralFee: Math.round(referralFee * 100) / 100,
    fbaFee: Math.round(fbaFee * 100) / 100,
    dhlShipping: Math.round(dhlShipping * 100) / 100,
    dhlSurcharges: Math.round(dhlSurcharges * 100) / 100,
    boxCost: Math.round(boxCost * 100) / 100,
    returnsCost: Math.round(returnsCost * 100) / 100,
    loyaltyCost: Math.round(loyaltyCost * 100) / 100,
    totalChannelCost
  };
}

/**
 * Check post-channel margin against ≥45% guardrail
 * 
 * Guardrail formula:
 * - Net Revenue = UVP - FullCost - ChannelCost
 * - Post-Channel Margin % = (Net Revenue / UVP) × 100
 * - Guardrail OK if Margin% ≥ Target (default 45%)
 * 
 * @param uvp - Unit sales price in EUR
 * @param fullCost - Total landed cost (8 components)
 * @param channelCost - Total channel-specific costs
 * @param targetMarginPct - Minimum acceptable margin % (default 45)
 * @returns Guardrail check result
 * 
 * @example
 * // Premium product: €27.60 UVP, €13.80 FullCost, €4.50 channel costs
 * const result = checkGuardrail(27.60, 13.80, 4.50, 45);
 * // netRevenue = 27.60 - 13.80 - 4.50 = 9.30
 * // postChannelMarginPct = (9.30 / 27.60) × 100 = 33.7%
 * // guardrailOK = false (< 45%)
 */
export function checkGuardrail(
  uvp: number,
  fullCost: number,
  channelCost: number,
  targetMarginPct: number = 45
): GuardrailResult {
  if (uvp <= 0) {
    return {
      netRevenue: 0,
      postChannelMarginPct: 0,
      guardrailOK: false
    };
  }

  // Net revenue after all costs
  const netRevenue = uvp - fullCost - channelCost;

  // Post-channel margin percentage
  const postChannelMarginPct = (netRevenue / uvp) * 100;

  // Check if margin meets guardrail threshold
  const guardrailOK = postChannelMarginPct >= targetMarginPct;

  return {
    netRevenue: Math.round(netRevenue * 100) / 100,
    postChannelMarginPct: Math.round(postChannelMarginPct * 100) / 100,
    guardrailOK
  };
}

// ============================================================================
// MAP ENFORCEMENT (Task 2.4) - Stubs for now
// ============================================================================

/**
 * Enforce MAP (Minimum Advertised Price) constraints
 * 
 * MAP is a legal constraint that prevents advertising products below
 * the manufacturer's minimum advertised price. This has highest priority
 * in the constraint hierarchy:
 * 1. Legal (MAP/PAngV) - MUST be enforced
 * 2. Floor multipliers - Business constraint
 * 3. Guardrails (≥45%) - Business target
 * 
 * @param uvp - Calculated unit sales price
 * @param map - Minimum advertised price (from manufacturer/supplier)
 * @param competitorMin - Optional lowest competitor price for tracking
 * @returns Adjusted UVP (raised to MAP if needed), violation flag, and reason
 * 
 * @example
 * // UVP below MAP - raises price to comply
 * enforceMAP(24.99, 29.99) 
 * // → { uvpAdjusted: 29.99, mapViolation: true, reason: "UVP €24.99 below MAP €29.99" }
 * 
 * @example
 * // UVP above MAP - no adjustment needed
 * enforceMAP(34.99, 29.99)
 * // → { uvpAdjusted: 34.99, mapViolation: false }
 */
export function enforceMAP(
  uvp: number,
  map: number,
  competitorMin?: number
): { uvpAdjusted: number; mapViolation: boolean; reason?: string } {
  // Handle edge cases
  if (map <= 0 || !isFinite(map)) {
    // No MAP constraint if MAP is invalid
    return {
      uvpAdjusted: uvp,
      mapViolation: false
    };
  }

  if (uvp <= 0 || !isFinite(uvp)) {
    // Invalid UVP - raise to MAP
    // Format uvp safely (toFixed throws on Infinity/NaN)
    const uvpStr = isFinite(uvp) ? `€${uvp.toFixed(2)}` : String(uvp);
    return {
      uvpAdjusted: map,
      mapViolation: true,
      reason: `Invalid UVP (${uvpStr}) - raised to MAP €${map.toFixed(2)}`
    };
  }

  // Check MAP violation
  if (uvp < map) {
    // UVP below MAP - raise to MAP (legal requirement)
    const reason = `UVP €${uvp.toFixed(2)} below MAP €${map.toFixed(2)} - adjusted to comply`;
    
    return {
      uvpAdjusted: map,
      mapViolation: true,
      reason
    };
  }

  // UVP meets or exceeds MAP - no adjustment needed
  // Note: competitorMin is tracked for analytics but doesn't affect pricing
  // (we can't price below MAP even if competitors do - that's their risk)
  return {
    uvpAdjusted: uvp,
    mapViolation: false
  };
}

// ============================================================================
// LINE TARGETS & FLOOR MULTIPLIERS (Task 2.5) - Stubs for now
// ============================================================================

/**
 * Apply line-specific targets and floor multipliers
 * 
 * Each product line (Premium, Pro, Basic, Tools) has different business constraints:
 * - Target margin % (business goal for post-channel margin)
 * - Floor multiplier (minimum UVP as multiple of FullCost)
 * - Guardrail margin % (absolute minimum acceptable margin)
 * 
 * Constraint priority hierarchy:
 * 1. Legal (MAP/PAngV) - Enforced by enforceMAP() and calculateGrundpreis()
 * 2. Floor (UVP ≥ FullCost × Floor_Multiplier) - This function
 * 3. Guardrail (≥45% margin) - Enforced by checkGuardrail()
 * 4. Rounding (.99/.95 cosmetic pricing) - Applied last
 * 
 * @param fullCost - Total landed cost (8 components)
 * @param line - Product line identifier ('Premium' | 'Pro' | 'Basic' | 'Tools')
 * @param ctx - Pricing context with lineTargets lookup table
 * @returns Minimum UVP, target margin %, and floor multiplier for the line
 * 
 * @example
 * // Premium line with 2.5x floor, 55% target margin
 * applyLineTargets(13.80, 'Premium', ctx)
 * // → { uvpMin: 34.50, targetMarginPct: 55, floorMultiplier: 2.5 }
 * 
 * @example
 * // Basic line with 2.0x floor, 48% target margin
 * applyLineTargets(10.00, 'Basic', ctx)
 * // → { uvpMin: 20.00, targetMarginPct: 48, floorMultiplier: 2.0 }
 */
export function applyLineTargets(
  fullCost: number,
  line: string,
  ctx: PricingLawContext
): { uvpMin: number; targetMarginPct: number; floorMultiplier: number; roundingStrategy?: string } {
  // Look up line-specific targets
  const lineTarget = ctx.lineTargets.find(
    lt => lt.Line === line && (lt.Active === undefined || lt.Active === true)
  );

  // Default fallback if line not found (conservative defaults)
  if (!lineTarget) {
    const defaultFloor = 2.2;
    return {
      uvpMin: Math.round(fullCost * defaultFloor * 100) / 100,
      targetMarginPct: 48,
      floorMultiplier: defaultFloor
    };
  }

  // Calculate minimum UVP from floor multiplier
  // Floor: UVP must be at least FullCost × multiplier
  // Example: €13.80 × 2.5 = €34.50 minimum
  const uvpMin = fullCost * lineTarget.Floor_Multiplier;

  return {
    uvpMin: Math.round(uvpMin * 100) / 100,
    targetMarginPct: lineTarget.Target_Margin_Pct,
    floorMultiplier: lineTarget.Floor_Multiplier,
    roundingStrategy: lineTarget.Rounding_Strategy
  };
}

// ============================================================================
// B2B DISCOUNTS (Task 2.6) - Stubs for now
// ============================================================================

/**
 * Calculate B2B role discount with quantity tiers and caps
 * 
 * Applies B2B discounts in this order:
 * 1. Role-based discount (from PartnerTiers)
 * 2. Quantity tier discount (from QuantityDiscounts)
 * 3. Apply caps (from DiscountCaps)
 * 
 * Note: Order-level discounts are applied separately after all line items
 * are calculated, not within this per-line function.
 * 
 * @param uvp - Unit sales price before discounts
 * @param role - Partner tier ('Dealer Basic', 'Dealer Plus', 'Stand', 'Distributor')
 * @param quantity - Quantity of this SKU in the order
 * @param orderValue - Total order value (not used here - for order discounts)
 * @param ctx - Pricing context with partnerTiers, quantityDiscounts, discountCaps
 * @returns Net price, total discount %, and capping flag
 * 
 * @example
 * // Dealer Basic (10% role) buying 8 units → 5% qty discount
 * calculateB2BDiscount(100, 'Dealer Basic', 8, 0, ctx)
 * // → { netPrice: 85.50, discountPct: 14.5, discountCapped: false }
 * // (100 - 10% = 90, 90 - 5% = 85.50, total 14.5%)
 * 
 * @example
 * // Distributor (25% role) with 15% cap
 * calculateB2BDiscount(100, 'Distributor', 1, 0, ctx)
 * // → { netPrice: 85.00, discountPct: 15, discountCapped: true }
 * // (25% role capped to 15%)
 */
export function calculateB2BDiscount(
  uvp: number,
  role: string,
  quantity: number,
  orderValue: number,
  ctx: PricingLawContext
): { netPrice: number; discountPct: number; discountCapped: boolean } {
  if (uvp <= 0) {
    return {
      netPrice: 0,
      discountPct: 0,
      discountCapped: false
    };
  }

  let roleDiscountPct = 0;
  let qtyDiscountPct = 0;
  let discountCapped = false;

  // Step 1: Apply role-based discount
  // Look up role discount from PartnerTiers (not in ctx - using hardcoded mapping for now)
  // In production, this would be looked up from ctx.partnerTiers
  const roleLookup: Record<string, number> = {
    'Dealer Basic': 10,
    'Dealer Plus': 12,
    'Stand': 15,
    'Distributor': 25
  };
  roleDiscountPct = roleLookup[role] ?? 0;

  // Step 2: Apply quantity tier discount
  // Find ALL applicable quantity discount tiers, then select best one
  // Priority: Partner-specific tiers > Generic "All" tiers
  // Then choose highest Discount_Pct among applicable tiers
  const applicableQtyDiscounts = ctx.quantityDiscounts.filter(
    qd => (qd.Active === undefined || qd.Active === true) &&
          (qd.AppliesTo === 'All' || qd.AppliesTo === role) &&
          quantity >= qd.MinQty &&
          (qd.MaxQty === undefined || qd.MaxQty === null || quantity <= qd.MaxQty)
  );

  if (applicableQtyDiscounts.length > 0) {
    // Prefer partner-specific tiers, then highest discount
    const partnerSpecific = applicableQtyDiscounts.filter(qd => qd.AppliesTo === role);
    const tiersToConsider = partnerSpecific.length > 0 ? partnerSpecific : applicableQtyDiscounts;
    
    // Choose tier with highest discount percentage
    const bestQtyTier = tiersToConsider.reduce((best, current) => 
      current.Discount_Pct > best.Discount_Pct ? current : best
    );
    
    qtyDiscountPct = bestQtyTier.Discount_Pct;
  }

  // Calculate combined discount percentage
  let combinedDiscountPct = roleDiscountPct + qtyDiscountPct;

  // Step 3: Apply discount caps
  const cap = ctx.discountCaps.find(
    dc => dc.PartnerTier === role && (dc.Active === undefined || dc.Active === true)
  );

  if (cap) {
    // Check individual caps
    if (cap.Max_Role_Discount_Pct !== undefined && roleDiscountPct > cap.Max_Role_Discount_Pct) {
      roleDiscountPct = cap.Max_Role_Discount_Pct;
      discountCapped = true;
    }

    if (cap.Max_Quantity_Discount_Pct !== undefined && qtyDiscountPct > cap.Max_Quantity_Discount_Pct) {
      qtyDiscountPct = cap.Max_Quantity_Discount_Pct;
      discountCapped = true;
    }

    // Recalculate combined after individual caps
    combinedDiscountPct = roleDiscountPct + qtyDiscountPct;

    // Check combined cap
    if (combinedDiscountPct > cap.Max_Combined_Discount_Pct) {
      combinedDiscountPct = cap.Max_Combined_Discount_Pct;
      discountCapped = true;
    }
  }

  // Calculate final net price
  // Net = UVP × (1 - discount%)
  const netPrice = uvp * (1 - combinedDiscountPct / 100);

  return {
    netPrice: Math.round(netPrice * 100) / 100,
    discountPct: Math.round(combinedDiscountPct * 100) / 100,
    discountCapped
  };
}
