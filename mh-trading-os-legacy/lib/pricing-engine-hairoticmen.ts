/**
 * HAIROTICMEN Pricing Engine v3
 * Comprehensive pricing engine covering:
 * - German regulations (PAngV Grundpreis)
 * - UVP calculation by product line with target margins
 * - B2B partner pricing with floor protection
 * - Channel costs & guardrails (B2C, Amazon)
 * - Gift attachments, loyalty, and commission systems
 */

import type { 
  FinalPriceList, 
  PricingParam,
  Channel,
  AmazonSizeTier,
  ShippingMatrixDHL,
  DHLSurcharge,
  HAIROTICMENPriceBreakdown
} from '@shared/schema';
import { z } from 'zod';

/**
 * Safe numeric coercion with validation
 * Returns parsed number or throws with clear error message
 */
function safeParseNumber(value: any, context: string): number {
  const result = z.coerce.number().safeParse(value);
  if (!result.success) {
    throw new Error(`${context}: Invalid numeric value '${value}' - ${result.error.message}`);
  }
  return result.data;
}

/**
 * Safe numeric coercion with optional fallback
 * Returns parsed number, fallback, or undefined if neither valid
 */
function safeParseNumberOpt(value: any, fallback?: number): number | undefined {
  if (value === undefined || value === null) return fallback;
  const result = z.coerce.number().safeParse(value);
  return result.success ? result.data : fallback;
}

/**
 * Normalize product line to TitleCase for consistent Map lookups
 * Handles: "PROFESSIONAL" → "Professional", "PREMIUM" → "Premium", etc.
 */
function normalizeProductLine(line: string | undefined | null): string {
  if (!line) return 'Basic';
  
  // Convert to lowercase, then capitalize first letter
  const normalized = line.toLowerCase();
  const titleCase = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  
  // Map known variants to canonical names
  const canonicalNames: Record<string, string> = {
    'Pro': 'Professional',
    'Prem': 'Premium',
  };
  
  return canonicalNames[titleCase] || titleCase;
}

/**
 * Pricing context for HAIROTICMEN engine (Sheet-driven)
 */
export interface HAIROTICMENPricingContext {
  params: Map<string, number>;
  fxBuffer: number; // Default 3%
  vat: number; // Default 19%
  lineMargins: Map<string, number>; // Target margins by product line
  lineFloorMultipliers: Map<string, number>; // Floor multipliers by line
  channelCosts: {
    adPct: Map<string, number>; // By product line
    returnsPct: number;
    loyaltyPct: number;
    paymentPct: number;
  };
  
  // Sheet-driven data
  channels: Channel[];
  amazonTiers: AmazonSizeTier[];
  shippingMatrix: ShippingMatrixDHL[];
  dhlSurcharges: DHLSurcharge[];
  
  // Helper lookups
  getChannel: (id: string) => Channel | undefined;
  getAmazonTier: (tierKey: string) => AmazonSizeTier | undefined;
  getDHLRate: (zone: string, weightG: number) => ShippingMatrixDHL | undefined;
}

/**
 * Build pricing context from parameters (Sheet-driven, not hard-coded)
 */
export function buildHAIROTICMENContext(
  params: PricingParam[],
  channels: Channel[] = [],
  amazonTiers: AmazonSizeTier[] = [],
  shippingMatrix: ShippingMatrixDHL[] = [],
  dhlSurcharges: DHLSurcharge[] = []
): HAIROTICMENPricingContext {
  const paramsMap = new Map<string, number>();
  params.forEach(p => {
    const numValue = parseFloat(p.Value);
    if (!isNaN(numValue)) {
      paramsMap.set(p.ParamKey, numValue);
    }
  });
  
  // Read from sheets with fallback defaults (3% FX buffer, 19% VAT)
  const fxBuffer = paramsMap.get('FX_BUFFER_PCT') ?? 3;
  const vat = paramsMap.get('VAT_DEFAULT_PCT') ?? 19;
  
  // Target margins by product line - read from Pricing_Params or use defaults
  const lineMargins = new Map<string, number>([
    ['Premium', paramsMap.get('TARGET_MARGIN_PREMIUM_PCT') ?? 75],
    ['Professional', paramsMap.get('TARGET_MARGIN_PROFESSIONAL_PCT') ?? 62],
    ['Pro', paramsMap.get('TARGET_MARGIN_PROFESSIONAL_PCT') ?? 62],
    ['Basic', paramsMap.get('TARGET_MARGIN_BASIC_PCT') ?? 50],
    ['Tools', paramsMap.get('TARGET_MARGIN_TOOLS_PCT') ?? 48]
  ]);
  
  // Floor multipliers by product line - read from Pricing_Params or use defaults
  const lineFloorMultipliers = new Map<string, number>([
    ['Premium', paramsMap.get('FLOOR_MULTIPLIER_PREMIUM') ?? 2.5],
    ['Professional', paramsMap.get('FLOOR_MULTIPLIER_PROFESSIONAL') ?? 2.4],
    ['Pro', paramsMap.get('FLOOR_MULTIPLIER_PROFESSIONAL') ?? 2.4],
    ['Basic', paramsMap.get('FLOOR_MULTIPLIER_BASIC') ?? 2.1],
    ['Tools', paramsMap.get('FLOOR_MULTIPLIER_TOOLS') ?? 1.8]
  ]);
  
  // Channel costs by product line - read from Pricing_Params or use defaults
  const adPctByLine = new Map<string, number>([
    ['Premium', paramsMap.get('AD_PCT_PREMIUM') ?? 13],
    ['Professional', paramsMap.get('AD_PCT_PROFESSIONAL') ?? 10],
    ['Pro', paramsMap.get('AD_PCT_PROFESSIONAL') ?? 10],
    ['Basic', paramsMap.get('AD_PCT_BASIC') ?? 8],
    ['Tools', paramsMap.get('AD_PCT_TOOLS') ?? 6]
  ]);
  
  // Helper lookups
  const getChannel = (id: string) => channels.find(c => c.ChannelID === id);
  const getAmazonTier = (tierKey: string) => amazonTiers.find(t => t.TierKey === tierKey);
  const getDHLRate = (zone: string, weightG: number) => 
    shippingMatrix.find(r => 
      r.Zone === zone && 
      weightG >= r.Weight_Min_g && 
      weightG <= r.Weight_Max_g
    );
  
  return {
    params: paramsMap,
    fxBuffer,
    vat,
    lineMargins,
    lineFloorMultipliers,
    channelCosts: {
      adPct: adPctByLine,
      returnsPct: paramsMap.get('RETURNS_PCT') ?? 2,
      loyaltyPct: paramsMap.get('LOYALTY_PCT') ?? 0.7,
      paymentPct: paramsMap.get('PAYMENT_PCT') ?? 2.5
    },
    channels,
    amazonTiers,
    shippingMatrix,
    dhlSurcharges,
    getChannel,
    getAmazonTier,
    getDHLRate
  };
}

/**
 * Calculate factory price unit (final) with FX buffer
 */
function calculateFactoryPriceUnitFinal(
  product: FinalPriceList,
  ctx: HAIROTICMENPricingContext
): number {
  // If manual factory price is provided, use it
  if (product.FactoryPriceUnit_Manual && product.FactoryPriceUnit_Manual > 0) {
    return product.FactoryPriceUnit_Manual * (1 + ctx.fxBuffer / 100);
  }
  
  // Otherwise, calculate from carton pricing
  if (product.TotalFactoryPriceCarton && product.UnitsPerCarton && product.UnitsPerCarton > 0) {
    const unitPrice = product.TotalFactoryPriceCarton / product.UnitsPerCarton;
    const fxBufferPct = product.FX_BufferPct || ctx.fxBuffer;
    return unitPrice * (1 + fxBufferPct / 100);
  }
  
  // Fallback to legacy Factory_Cost_EUR
  if (product.Factory_Cost_EUR && product.Factory_Cost_EUR > 0) {
    return product.Factory_Cost_EUR * (1 + ctx.fxBuffer / 100);
  }
  
  return 0;
}

/**
 * Calculate full cost per unit (8 components + factory price)
 */
function calculateFullCostUnit(
  product: FinalPriceList,
  factoryPriceUnit: number
): number {
  // Ensure all values are numbers (Google Sheets may return strings)
  const components = [
    factoryPriceUnit,
    Number(product.Shipping_Inbound_per_unit) || 0,
    Number(product.EPR_LUCID_per_unit) || 0,
    Number(product.GS1_per_unit) || 0,
    Number(product.Retail_Packaging_per_unit) || 0,
    Number(product.QC_PIF_per_unit) || 0,
    Number(product.Operations_per_unit) || 0,
    Number(product.Marketing_per_unit) || 0
  ];
  
  return components.reduce((sum, val) => sum + val, 0);
}

/**
 * Calculate gift expected cost per unit
 */
function calculateGiftExpectedCost(product: FinalPriceList): number {
  if (!product.Gift_SKU || !product.Gift_Attach_Rate || product.Gift_Attach_Rate === 0) {
    return 0;
  }
  
  const giftCost = product.Gift_SKU_Cost || 0;
  const fundingPct = product.Gift_Funding_Pct || 0;
  const shippingIncrement = product.Gift_Shipping_Increment || 0;
  const attachRate = product.Gift_Attach_Rate;
  
  // Expected cost = (gift cost × (1 - funding%) + shipping) × attach rate
  const netGiftCost = giftCost * (1 - fundingPct / 100) + shippingIncrement;
  return netGiftCost * attachRate;
}

/**
 * Calculate UVP (Recommended Retail Price) based on product line
 */
function calculateUVP(
  product: FinalPriceList,
  fullCostUnit: number,
  ctx: HAIROTICMENPricingContext
): { uvpNet: number; uvpInc: number } {
  // If manual UVP (inc VAT) is provided, use it
  if (product.Manual_UVP_Inc && product.Manual_UVP_Inc > 0) {
    const vatPct = product["VAT%"] || ctx.vat;
    const uvpNet = product.Manual_UVP_Inc / (1 + vatPct / 100);
    return { uvpNet, uvpInc: product.Manual_UVP_Inc };
  }
  
  // Otherwise, calculate based on product line margin
  const line = normalizeProductLine(product.Line);
  const targetMargin = ctx.lineMargins.get(line) || 50;
  
  // UVP_Net = FullCost / (1 - Target_GM%)
  const uvpNet = fullCostUnit / (1 - targetMargin / 100);
  
  // UVP_Inc = UVP_Net × (1 + VAT%)
  const vatPct = product["VAT%"] || ctx.vat;
  const uvpInc = uvpNet * (1 + vatPct / 100);
  
  return { uvpNet, uvpInc };
}

/**
 * Calculate Grundpreis (German PAngV requirement) - €/L or €/kg
 * IMPORTANT: PAngV requires GROSS prices (including VAT), not net prices
 */
function calculateGrundpreis(
  product: FinalPriceList,
  uvpInc: number
): { grundpreisGross: number; grundpreisUnit: 'L' | 'kg'; grundpreisFormatted: string } {
  // Determine unit type based on product
  const netContentMl = product.Net_Content_ml || product.Content_ml || 0;
  const weightG = product.Weight_g || 0;
  
  let grundpreisGross = 0;
  let grundpreisUnit: 'L' | 'kg' = 'L';
  
  // If liquid content is available, calculate €/L (including VAT)
  if (netContentMl > 0) {
    grundpreisGross = uvpInc / (netContentMl / 1000); // Convert ml to L, use UVP with VAT
    grundpreisUnit = 'L';
  }
  // Otherwise, calculate €/kg (including VAT)
  else if (weightG > 0) {
    grundpreisGross = uvpInc / (weightG / 1000); // Convert g to kg, use UVP with VAT
    grundpreisUnit = 'kg';
  }
  
  const grundpreisFormatted = `€${grundpreisGross.toFixed(2)}/${grundpreisUnit}`;
  
  return { grundpreisGross, grundpreisUnit, grundpreisFormatted };
}

/**
 * Calculate B2C floor price based on product line
 */
function calculateFloorB2CNet(
  fullCostUnit: number,
  line: string,
  ctx: HAIROTICMENPricingContext
): number {
  const normalizedLine = normalizeProductLine(line);
  const multiplier = ctx.lineFloorMultipliers.get(normalizedLine) || 2.1;
  return fullCostUnit * multiplier;
}

/**
 * Calculate B2C Store channel pricing with guardrails (Sheet-driven)
 */
function calculateB2CStoreChannel(
  product: FinalPriceList,
  uvpInc: number,
  fullCostUnit: number,
  ctx: HAIROTICMENPricingContext
) {
  const line = normalizeProductLine(product.Line);
  
  // Channel costs (percentage-based)
  const adPct = product.Ad_Pct || ctx.channelCosts.adPct.get(line) || 10;
  const returnsPct = product.Returns_Pct || ctx.channelCosts.returnsPct;
  const loyaltyPct = product.Loyalty_Pct || ctx.channelCosts.loyaltyPct;
  const paymentPct = product.Payment_Pct || ctx.channelCosts.paymentPct;
  
  const grossRevenue = uvpInc;
  const adCost = grossRevenue * (adPct / 100);
  const returnsCost = grossRevenue * (returnsPct / 100);
  const loyaltyCost = grossRevenue * (loyaltyPct / 100);
  const paymentCost = grossRevenue * (paymentPct / 100);
  
  // DHL fulfillment costs (sheet-driven)
  let dhlShipping = 0;
  let dhlSurcharges = 0;
  if (product.Weight_g) {
    // Read zone: SKU-level > Channel-level > Default
    const ownStoreChannel = ctx.getChannel('OwnStore');
    const dhlZone = product.DHL_Zone ?? (ownStoreChannel as any)?.DHL_Zone ?? 'DE_1';
    
    const dhlRate = ctx.getDHLRate(dhlZone, product.Weight_g);
    if (dhlRate) {
      dhlShipping = dhlRate.Base_Rate_EUR || 0;
      
      // Add ALL active DHL surcharges (sheet-driven with validated coercion)
      const activeSurcharges = ctx.dhlSurcharges.filter(s => s.Active);
      
      // Aggregate fixed and percentage surcharges with proper compounding
      // Percentage surcharges compound on (base + all prior surcharges)
      let runningTotal = dhlShipping; // Start with base rate
      let fixedTotal = 0;
      
      // First pass: apply all fixed surcharges with validated parsing (hard-fail on bad data)
      for (const surcharge of activeSurcharges) {
        if (surcharge.Type === 'Fixed_Per_Shipment') {
          const amount = safeParseNumber(
            surcharge.Amount_EUR, 
            `DHL surcharge ${surcharge.SurchargeKey} Amount_EUR`
          );
          runningTotal += amount;
          fixedTotal += amount;
        }
      }
      
      // Second pass: apply percentage surcharges (compound on running total) with validated parsing (hard-fail on bad data)
      for (const surcharge of activeSurcharges) {
        if (surcharge.Type === 'Pct_Of_Base') {
          const pct = safeParseNumber(
            surcharge.Pct_Of_Base,
            `DHL surcharge ${surcharge.SurchargeKey} Pct_Of_Base`
          );
          // Compound on current running total (base + fixed + prior percentages)
          const pctAmount = (runningTotal * pct) / 100;
          runningTotal += pctAmount;
        }
      }
      
      // Surcharges = total - base
      dhlSurcharges = runningTotal - dhlShipping;
      
      /**
       * POLICY: Monthly_Variable surcharges
       * 
       * Monthly-variable surcharges (e.g., fuel adjustments) are excluded from 
       * per-shipment pricing calculations. Rationale:
       * - They represent periodic adjustments applied at month-end reconciliation
       * - Including them in per-shipment UVP would double-charge customers
       * - Should be handled separately in monthly billing/invoice adjustments
       * 
       * For per-shipment pricing, ONLY Fixed_Per_Shipment and Pct_Of_Base surcharges apply.
       */
    }
  }
  
  const totalChannelCosts = adCost + returnsCost + loyaltyCost + paymentCost + dhlShipping + dhlSurcharges;
  const netRevenue = grossRevenue - totalChannelCosts;
  const margin = netRevenue - fullCostUnit;
  
  // Guardrail: Contribution margin vs gross revenue (not net)
  const contributionMargin = grossRevenue - fullCostUnit - totalChannelCosts;
  const marginPct = (contributionMargin / grossRevenue) * 100;
  
  // Guardrail: Margin should be at least 45%
  const guardrailPassed = marginPct >= 45;
  
  return {
    grossRevenue,
    adCost,
    returnsCost,
    loyaltyCost,
    paymentCost,
    dhlShipping,
    dhlSurcharges,
    totalChannelCosts,
    netRevenue,
    margin,
    marginPct,
    guardrailPassed
  };
}

/**
 * Calculate Amazon channel pricing with referral fees + FBA fulfillment (Sheet-driven)
 */
function calculateAmazonChannel(
  product: FinalPriceList,
  uvpInc: number,
  fullCostUnit: number,
  ctx: HAIROTICMENPricingContext
) {
  const line = normalizeProductLine(product.Line);
  
  // Amazon referral fee - read from Channel sheet or use product override
  const amazonChannel = ctx.getChannel('Amazon_FBA') || ctx.getChannel('Amazon_FBM');
  const referralPctLow = amazonChannel?.Amazon_Referral_Pct_Low ?? 8;
  const referralPctHigh = amazonChannel?.Amazon_Referral_Pct_High ?? 15;
  const referralMin = amazonChannel?.Amazon_Referral_Min_EUR ?? 0.30;
  
  // Tiered referral: ≤€10 → low%, >€10 → high%
  const referralPct = product.Amazon_Referral_Pct ?? (uvpInc <= 10 ? referralPctLow : referralPctHigh);
  
  // Amazon FBA fulfillment fee - read from Amazon size tier sheet
  let fbaFee = 0;
  const warnings: string[] = [];
  
  if (product.Amazon_TierKey) {
    const tier = ctx.getAmazonTier(product.Amazon_TierKey);
    if (!tier) {
      // Hard-fail with explicit warning if tier key present but tier missing
      const warningMsg = `Missing tier data for TierKey: ${product.Amazon_TierKey} (SKU: ${product.SKU})`;
      warnings.push(warningMsg);
      console.warn(`[Amazon] ${warningMsg}`);
    } else {
      // FBA fee = base fee + 2025 surcharge
      const baseFee = tier.FBA_Fee_EUR || 0;
      const surcharge = tier.FBA_Surcharge_2025_EUR || 0;
      fbaFee = baseFee + surcharge;
    }
  }
  
  // Other channel costs
  const adPct = product.Ad_Pct || ctx.channelCosts.adPct.get(line) || 10;
  const returnsPct = product.Returns_Pct || ctx.channelCosts.returnsPct;
  const paymentPct = 0; // Amazon handles payment processing
  
  const grossRevenue = uvpInc;
  const referralFee = Math.max(grossRevenue * (referralPct / 100), referralMin);
  const adCost = grossRevenue * (adPct / 100);
  const returnsCost = grossRevenue * (returnsPct / 100);
  const paymentCost = 0;
  
  const totalChannelCosts = referralFee + adCost + returnsCost + fbaFee;
  const netRevenue = grossRevenue - totalChannelCosts;
  const margin = netRevenue - fullCostUnit;
  
  // Guardrail: Contribution margin vs gross revenue (not net)
  const contributionMargin = grossRevenue - fullCostUnit - totalChannelCosts;
  const marginPct = (contributionMargin / grossRevenue) * 100;
  
  // Guardrail: Margin should be at least 45%
  const guardrailPassed = marginPct >= 45;
  
  return {
    grossRevenue,
    referralFee,
    fbaFee,
    adCost,
    returnsCost,
    paymentCost,
    totalChannelCosts,
    netRevenue,
    margin,
    marginPct,
    guardrailPassed,
    warnings
  };
}

/**
 * Calculate B2B partner pricing with floor protection
 * According to pricing law: MAX(UVP × discount, Floor_B2C_Net)
 */
function calculatePartnerPricing(
  uvpNet: number,
  floorB2CNet: number
) {
  // Dealer Basic: MAX(UVP × 0.60, Floor)
  // 60% of UVP = 40% discount from UVP
  const dealerBasicPrice = Math.max(uvpNet * 0.60, floorB2CNet);
  const dealerBasicFloorProtected = dealerBasicPrice === floorB2CNet;
  
  // Dealer Plus: MAX(UVP × 0.50, Floor)
  // 50% of UVP = 50% discount from UVP
  const dealerPlusPrice = Math.max(uvpNet * 0.50, floorB2CNet);
  const dealerPlusFloorProtected = dealerPlusPrice === floorB2CNet;
  
  // Stand Partner: MAX(UVP × 0.70, Floor) with separate 5% bonus
  // 70% of UVP = 30% discount from UVP, plus external 5% bonus
  const standBasePrice = uvpNet * 0.70;
  const standBonus = uvpNet * 0.05; // 5% bonus calculated from UVP, not base price
  const standFinalPrice = Math.max(standBasePrice, floorB2CNet);
  const standFloorProtected = standFinalPrice === floorB2CNet;
  
  // Distributor: MAX(UVP × 0.40, Floor)
  // 40% of UVP = 60% discount from UVP
  const distributorPrice = Math.max(uvpNet * 0.40, floorB2CNet);
  const distributorFloorProtected = distributorPrice === floorB2CNet;
  
  return {
    dealerBasic: {
      netPrice: dealerBasicPrice,
      discount: '40%',
      floorProtected: dealerBasicFloorProtected
    },
    dealerPlus: {
      netPrice: dealerPlusPrice,
      discount: '50%',
      floorProtected: dealerPlusFloorProtected
    },
    standPartner: {
      netPrice: standFinalPrice,
      discount: '30%',
      bonus: standBonus,
      totalDiscount: '30% + 5% bonus (external)',
      floorProtected: standFloorProtected
    },
    distributor: {
      netPrice: distributorPrice,
      discount: '60%',
      floorProtected: distributorFloorProtected
    }
  };
}

/**
 * Main pricing calculation for a single SKU
 */
export function calculateHAIROTICMENPricing(
  product: FinalPriceList,
  ctx: HAIROTICMENPricingContext
): HAIROTICMENPriceBreakdown {
  const guardrails: string[] = [];
  const warnings: string[] = [];
  
  // Step 1: Factory price with FX buffer
  const factoryPriceUnitFinal = calculateFactoryPriceUnitFinal(product, ctx);
  if (factoryPriceUnitFinal === 0) {
    warnings.push('Missing factory price data');
  }
  
  // Step 2: Full cost (factory + 8 components)
  let fullCostUnit = calculateFullCostUnit(product, factoryPriceUnitFinal);
  
  // Step 3: Gift expected cost - MUST be included in full cost
  const giftExpectedCost = calculateGiftExpectedCost(product);
  fullCostUnit = fullCostUnit + giftExpectedCost; // Add gift cost to full cost
  
  // Step 4: UVP calculation (using fullCostUnit which now includes gift)
  const { uvpNet, uvpInc } = calculateUVP(product, fullCostUnit, ctx);
  
  // Step 5: Grundpreis (PAngV) - MUST use gross price (with VAT)
  const { grundpreisGross, grundpreisUnit, grundpreisFormatted } = calculateGrundpreis(product, uvpInc);
  if (grundpreisGross === 0) {
    warnings.push('Cannot calculate Grundpreis - missing Content_ml/Net_Content_ml or Weight_g');
  }
  
  // Step 6: B2C Floor price (using fullCostUnit which includes gift)
  const line = product.Line || 'Basic';
  const floorB2CNet = calculateFloorB2CNet(fullCostUnit, line, ctx);
  
  // Step 7: Channel pricing (using fullCostUnit which includes gift)
  const b2cStore = calculateB2CStoreChannel(product, uvpInc, fullCostUnit, ctx);
  const amazon = calculateAmazonChannel(product, uvpInc, fullCostUnit, ctx);
  
  // Bubble amazon warnings to top-level warnings array
  warnings.push(...amazon.warnings);
  
  // Step 8: Partner pricing
  const partnerPricing = calculatePartnerPricing(uvpNet, floorB2CNet);
  
  // Guardrails
  if (!b2cStore.guardrailPassed) {
    guardrails.push(`B2C Store margin ${b2cStore.marginPct.toFixed(1)}% below 45% threshold`);
  }
  if (!amazon.guardrailPassed) {
    guardrails.push(`Amazon margin ${amazon.marginPct.toFixed(1)}% below 45% threshold`);
  }
  if (partnerPricing.dealerBasic.floorProtected) {
    guardrails.push('Dealer Basic price limited by floor protection');
  }
  if (partnerPricing.dealerPlus.floorProtected) {
    guardrails.push('Dealer Plus price limited by floor protection');
  }
  if (partnerPricing.standPartner.floorProtected) {
    guardrails.push('Stand Partner price limited by floor protection');
  }
  if (partnerPricing.distributor.floorProtected) {
    guardrails.push('Distributor price limited by floor protection');
  }
  
  return {
    sku: product.SKU,
    name: product.Name,
    factoryPriceUnitFinal,
    fullCostUnit, // Already includes gift cost
    uvpNet,
    uvpInc,
    grundpreisGross, // PAngV-compliant gross price (including VAT)
    grundpreisUnit,
    grundpreisFormatted,
    floorB2CNet,
    b2cStore,
    amazon,
    ...partnerPricing, // Expands dealerBasic, dealerPlus, standPartner, distributor
    giftExpectedCost, // Separate for transparency
    guardrails,
    warnings
  };
}

/**
 * Batch pricing calculation for multiple SKUs
 */
export function calculateHAIROTICMENPricingBatch(
  products: FinalPriceList[],
  ctx: HAIROTICMENPricingContext
): HAIROTICMENPriceBreakdown[] {
  return products.map(product => calculateHAIROTICMENPricing(product, ctx));
}

/**
 * Generate detailed pricing explanation for a single SKU
 */
export function explainHAIROTICMENPricing(
  product: FinalPriceList,
  ctx: HAIROTICMENPricingContext
): string {
  const breakdown = calculateHAIROTICMENPricing(product, ctx);
  
  let explanation = `══════════════════════════════════════════════════\n`;
  explanation += `HAIROTICMEN Pricing Breakdown: ${product.SKU}\n`;
  explanation += `${product.Name}\n`;
  explanation += `══════════════════════════════════════════════════\n\n`;
  
  explanation += `📦 FACTORY & COST CALCULATION\n`;
  explanation += `─────────────────────────────────────────────────\n`;
  explanation += `Factory Price (Unit, Final): €${breakdown.factoryPriceUnitFinal.toFixed(4)}\n`;
  explanation += `  └─ Includes ${ctx.fxBuffer}% FX Buffer\n\n`;
  
  explanation += `Full Cost Components:\n`;
  explanation += `  • Factory Price:        €${breakdown.factoryPriceUnitFinal.toFixed(4)}\n`;
  explanation += `  • Shipping Inbound:     €${(product.Shipping_Inbound_per_unit || 0).toFixed(4)}\n`;
  explanation += `  • EPR LUCID:            €${(product.EPR_LUCID_per_unit || 0).toFixed(4)}\n`;
  explanation += `  • GS1:                  €${(product.GS1_per_unit || 0).toFixed(4)}\n`;
  explanation += `  • Retail Packaging:     €${(product.Retail_Packaging_per_unit || 0).toFixed(4)}\n`;
  explanation += `  • QC PIF:               €${(product.QC_PIF_per_unit || 0).toFixed(4)}\n`;
  explanation += `  • Operations:           €${(product.Operations_per_unit || 0).toFixed(4)}\n`;
  explanation += `  • Marketing:            €${(product.Marketing_per_unit || 0).toFixed(4)}\n`;
  if (breakdown.giftExpectedCost > 0) {
    explanation += `  • Gift Expected Cost:   €${breakdown.giftExpectedCost.toFixed(4)}\n`;
  }
  explanation += `  ───────────────────────────────────────\n`;
  explanation += `  TOTAL FULL COST:        €${breakdown.fullCostUnit.toFixed(4)}\n\n`;
  
  explanation += `💶 UVP CALCULATION (German Regulations)\n`;
  explanation += `─────────────────────────────────────────────────\n`;
  const line = normalizeProductLine(product.Line);
  const targetMargin = ctx.lineMargins.get(line) || 50;
  explanation += `Product Line: ${line} (Target Margin: ${targetMargin}%)\n`;
  explanation += `UVP Net:  €${breakdown.uvpNet.toFixed(2)}\n`;
  explanation += `UVP Inc:  €${breakdown.uvpInc.toFixed(2)} (with ${product["VAT%"] || ctx.vat}% VAT)\n\n`;
  
  explanation += `📏 GRUNDPREIS (PAngV Compliance)\n`;
  explanation += `─────────────────────────────────────────────────\n`;
  explanation += `${breakdown.grundpreisFormatted}\n\n`;
  
  explanation += `🛡️ B2C FLOOR PROTECTION\n`;
  explanation += `─────────────────────────────────────────────────\n`;
  const multiplier = ctx.lineFloorMultipliers.get(line) || 2.1;
  explanation += `Floor = Full Cost × ${multiplier}× = €${breakdown.floorB2CNet.toFixed(2)}\n\n`;
  
  explanation += `🛒 CHANNEL PRICING\n`;
  explanation += `─────────────────────────────────────────────────\n`;
  explanation += `B2C Store:\n`;
  explanation += `  Gross Revenue:     €${breakdown.b2cStore.grossRevenue.toFixed(2)}\n`;
  explanation += `  - Ad Cost:         €${breakdown.b2cStore.adCost.toFixed(2)}\n`;
  explanation += `  - Returns:         €${breakdown.b2cStore.returnsCost.toFixed(2)}\n`;
  explanation += `  - Loyalty:         €${breakdown.b2cStore.loyaltyCost.toFixed(2)}\n`;
  explanation += `  - Payment:         €${breakdown.b2cStore.paymentCost.toFixed(2)}\n`;
  explanation += `  Net Revenue:       €${breakdown.b2cStore.netRevenue.toFixed(2)}\n`;
  explanation += `  Margin:            €${breakdown.b2cStore.margin.toFixed(2)} (${breakdown.b2cStore.marginPct.toFixed(1)}%)\n`;
  explanation += `  Guardrail:         ${breakdown.b2cStore.guardrailPassed ? '✅ PASS' : '❌ FAIL'}\n\n`;
  
  explanation += `Amazon:\n`;
  explanation += `  Gross Revenue:     €${breakdown.amazon.grossRevenue.toFixed(2)}\n`;
  explanation += `  - Referral Fee:    €${breakdown.amazon.referralFee.toFixed(2)}\n`;
  explanation += `  - Ad Cost:         €${breakdown.amazon.adCost.toFixed(2)}\n`;
  explanation += `  - Returns:         €${breakdown.amazon.returnsCost.toFixed(2)}\n`;
  explanation += `  Net Revenue:       €${breakdown.amazon.netRevenue.toFixed(2)}\n`;
  explanation += `  Margin:            €${breakdown.amazon.margin.toFixed(2)} (${breakdown.amazon.marginPct.toFixed(1)}%)\n`;
  explanation += `  Guardrail:         ${breakdown.amazon.guardrailPassed ? '✅ PASS' : '❌ FAIL'}\n\n`;
  
  explanation += `🤝 B2B PARTNER PRICING\n`;
  explanation += `─────────────────────────────────────────────────\n`;
  explanation += `Dealer Basic (${breakdown.dealerBasic.discount}):   €${breakdown.dealerBasic.netPrice.toFixed(2)} ${breakdown.dealerBasic.floorProtected ? '🛡️' : ''}\n`;
  explanation += `Dealer Plus (${breakdown.dealerPlus.discount}):    €${breakdown.dealerPlus.netPrice.toFixed(2)} ${breakdown.dealerPlus.floorProtected ? '🛡️' : ''}\n`;
  explanation += `Stand Partner (${breakdown.standPartner.totalDiscount}): €${breakdown.standPartner.netPrice.toFixed(2)} ${breakdown.standPartner.floorProtected ? '🛡️' : ''}\n`;
  explanation += `Distributor (${breakdown.distributor.discount}):   €${breakdown.distributor.netPrice.toFixed(2)} ${breakdown.distributor.floorProtected ? '🛡️' : ''}\n\n`;
  
  if (breakdown.guardrails.length > 0) {
    explanation += `⚠️ GUARDRAILS\n`;
    explanation += `─────────────────────────────────────────────────\n`;
    breakdown.guardrails.forEach(g => explanation += `• ${g}\n`);
    explanation += `\n`;
  }
  
  if (breakdown.warnings.length > 0) {
    explanation += `⚡ WARNINGS\n`;
    explanation += `─────────────────────────────────────────────────\n`;
    breakdown.warnings.forEach(w => explanation += `• ${w}\n`);
  }
  
  return explanation;
}
