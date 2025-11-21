import type { FinalPriceList, PricingParam, CompetitorPrice, PartnerTier } from '@shared/schema';

export interface PricingContext {
  params: Map<string, number>;
  tiers: Map<string, PartnerTier>;
}

export interface PriceBreakdown {
  sku: string;
  cogs: number;
  landedCost: number;
  uvpRecommended: number;
  uvpWeb: number;
  uvpSalon: number;
  uvpAmazon: number;
  map: number;
  priceWeb: number;
  priceAmazon: number;
  priceSalon: number;
  netDealerBasic: number;
  netDealerPlus: number;
  netStand: number;
  netDistributor: number;
  competitorMin?: number;
  competitorMedian?: number;
  competitorAnalysis?: CompetitorAnalysis;
  priceSuggestion?: PriceSuggestion;
  guardrails: string[];
}

export function buildPricingContext(params: PricingParam[], tiers: PartnerTier[]): PricingContext {
  const paramsMap = new Map<string, number>();
  params.forEach(p => {
    const numValue = parseFloat(p.Value);
    if (!isNaN(numValue)) {
      paramsMap.set(p.ParamKey, numValue);
    }
  });

  const tiersMap = new Map<string, PartnerTier>();
  tiers.forEach(t => tiersMap.set(t.Tier, t));

  return { params: paramsMap, tiers: tiersMap };
}

// New detailed cost calculation using component breakdown
export function calculateDetailedLandedCost(
  product: FinalPriceList,
  ctx: PricingContext
): number {
  // Use detailed cost breakdown if available
  const factoryCost = product.Factory_Cost_EUR || 0;
  const packagingCost = product.Packaging_Cost_EUR || 0;
  const freightPerKg = product.Freight_kg_EUR || ctx.params.get('DEFAULT_FREIGHT_KG_EUR') || 0;
  const importDutyPct = product.Import_Duty_Pct ?? ctx.params.get('IMPORT_DUTY_PCT_DEFAULT') ?? 0;
  const overheadPct = product.Overhead_Pct ?? ctx.params.get('OVERHEAD_PCT_DEFAULT') ?? 0;
  
  const weight_kg = (product.Weight_g || 0) / 1000;
  
  // Step 1: Base costs
  let baseCost = factoryCost + packagingCost;
  
  // Step 2: Add freight (weight-based)
  const freightCost = freightPerKg * weight_kg;
  baseCost += freightCost;
  
  // Step 3: Add import duty (percentage of base cost)
  let landed = baseCost;
  if (importDutyPct > 0) {
    landed = landed * (1 + importDutyPct / 100);
  }
  
  // Step 4: Add overhead (percentage of total so far)
  if (overheadPct > 0) {
    landed = landed * (1 + overheadPct / 100);
  }
  
  return landed;
}

// Legacy calculation for backwards compatibility
export function calculateLandedCost(
  cogs: number,
  weight_g: number,
  ctx: PricingContext
): number {
  const fulfillBase = ctx.params.get('FULFILL_BASE_EUR') || 0;
  const fulfillPer100g = ctx.params.get('FULFILL_PER_100G_EUR') || 0;
  const returnsPct = ctx.params.get('RETURNS_PCT') || 0;
  const energyPct = ctx.params.get('ENERGY_PCT') || 0;

  let landed = cogs + fulfillBase + (weight_g / 100) * fulfillPer100g;
  
  if (returnsPct > 0) {
    landed = landed * (1 + returnsPct / 100);
  }
  
  if (energyPct > 0) {
    landed = landed * (1 + energyPct / 100);
  }

  return landed;
}

export function calculateUVP(
  landedCost: number,
  ctx: PricingContext
): number {
  const marginUVP = ctx.params.get('MARGIN_UVP_PCT') || 50;
  const minUVP = ctx.params.get('MIN_UVP_EUR') || 0;
  const rndUVP = ctx.params.get('RND_UVP') || 0.49;

  let uvp = landedCost / (1 - marginUVP / 100);
  
  if (uvp < minUVP) {
    uvp = minUVP;
  }

  // Apply rounding
  if (rndUVP > 0) {
    uvp = Math.floor(uvp) + rndUVP;
  } else {
    uvp = Math.round(uvp * 100) / 100;
  }

  return uvp;
}

export interface ChannelUVPs {
  uvpWeb: number;
  uvpSalon: number;
  uvpAmazon: number;
}

export function calculateChannelUVPs(
  landedCost: number,
  ctx: PricingContext
): ChannelUVPs {
  const minUVP = ctx.params.get('MIN_UVP_EUR') || 0;

  // Web channel
  const webMargin = ctx.params.get('TARGET_MARGIN_WEB_PCT') || 
                    ctx.params.get('MARGIN_UVP_PCT') || 50;
  const webRounding = ctx.params.get('RND_UVP_WEB') || 0.49;
  
  // Salon channel
  const salonMargin = ctx.params.get('TARGET_MARGIN_SALON_PCT') || 
                      ctx.params.get('MARGIN_UVP_PCT') || 40;
  const salonRounding = ctx.params.get('RND_UVP_SALON') || 0.99;
  
  // Calculate base UVPs
  let uvpWebRaw = landedCost / (1 - webMargin/100);
  let uvpSalonRaw = landedCost / (1 - salonMargin/100);
  
  // Apply minimum floor
  if (uvpWebRaw < minUVP) uvpWebRaw = minUVP;
  if (uvpSalonRaw < minUVP) uvpSalonRaw = minUVP;
  
  // Apply price endings
  const uvpWeb = applyPriceEnding(uvpWebRaw, webRounding);
  const uvpSalon = applyPriceEnding(uvpSalonRaw, salonRounding);
  const uvpAmazon = uvpWeb; // Amazon uses web pricing
  
  return { uvpWeb, uvpSalon, uvpAmazon };
}

function applyPriceEnding(price: number, ending: number): number {
  if (ending <= 0 || ending >= 1) {
    return Math.round(price * 100) / 100;
  }
  
  // Apply minimal price ending that respects the floor
  const baseEuro = Math.floor(price);
  let result = baseEuro + ending;
  
  // If floor+ending < raw price, bump to next euro to maintain guardrails
  // Example: price=10.80, ending=0.49 → floor=10, 10.49<10.80 → 11.49 ✓
  // Example: price=9.30, ending=0.49 → floor=9, 9.49≥9.30 → 9.49 ✓
  // Example: price=9.99, ending=0.49 → floor=9, 9.49<9.99 → 10.49 ✓
  if (result < price) {
    result = (baseEuro + 1) + ending;
  }
  
  return Math.round(result * 100) / 100;
}

export function calculateMAP(
  uvp: number,
  landedCost: number,
  ctx: PricingContext
): number {
  const mapDelta = ctx.params.get('MAP_DELTA_EUR');
  const mapPct = ctx.params.get('MAP_PCT');
  const minMarginPct = ctx.params.get('MIN_MARGIN_PCT') || 10;
  const rndMAP = ctx.params.get('RND_MAP') || 0.01;

  let map: number;
  
  if (mapDelta !== undefined) {
    map = uvp - mapDelta;
  } else if (mapPct !== undefined) {
    map = uvp * (1 - mapPct / 100);
  } else {
    map = uvp * 0.9; // default 10% off UVP
  }

  // Enforce minimum margin guard
  const minPrice = landedCost * (1 + minMarginPct / 100);
  if (map < minPrice) {
    map = minPrice;
  }

  // Apply rounding
  if (rndMAP > 0) {
    map = Math.floor(map * 100) / 100;
    const decimal = map - Math.floor(map);
    if (decimal < rndMAP) {
      map = Math.floor(map) + rndMAP;
    }
  }

  return map;
}

export function calculateChannelPrices(
  uvp: number,
  map: number,
  ctx: PricingContext
): {
  priceWeb: number;
  priceAmazon: number;
  priceSalon: number;
} {
  const webUplift = ctx.params.get('WEB_UPLIFT_PCT') || 0;
  const amazonFeePct = ctx.params.get('AMAZON_FEE_PCT') || 15;
  const salonUplift = ctx.params.get('SALON_UPLIFT_PCT') || 0;

  const priceWeb = uvp * (1 + webUplift / 100);
  const priceAmazon = uvp / (1 - amazonFeePct / 100); // gross up for Amazon fees
  const priceSalon = uvp * (1 + salonUplift / 100);

  return {
    priceWeb: Math.round(priceWeb * 100) / 100,
    priceAmazon: Math.round(priceAmazon * 100) / 100,
    priceSalon: Math.round(priceSalon * 100) / 100,
  };
}

export function calculateTierPrices(
  uvp: number,
  map: number,
  ctx: PricingContext
): {
  netDealerBasic: number;
  netDealerPlus: number;
  netStand: number;
  netDistributor: number;
} {
  const rndNet = ctx.params.get('RND_NET') || 0.01;

  const applyDiscount = (price: number, discountPct: number): number => {
    let net = price * (1 - discountPct / 100);
    
    // Enforce MAP floor unless override
    if (net < map) {
      net = map;
    }

    // Apply rounding
    if (rndNet > 0) {
      net = Math.floor(net * 100) / 100;
      const decimal = net - Math.floor(net);
      if (decimal < rndNet) {
        net = Math.floor(net) + rndNet;
      }
    }

    return net;
  };

  const basicTier = ctx.tiers.get('Basic');
  const plusTier = ctx.tiers.get('Plus');
  const standTier = ctx.tiers.get('Stand');
  const distributorTier = ctx.tiers.get('Distributor');

  return {
    netDealerBasic: applyDiscount(uvp, basicTier?.DiscountPct || 10),
    netDealerPlus: applyDiscount(uvp, plusTier?.DiscountPct || 20),
    netStand: applyDiscount(uvp, standTier?.DiscountPct || 25),
    netDistributor: applyDiscount(uvp, distributorTier?.DiscountPct || 35),
  };
}

export function calculateCompetitorStats(
  sku: string,
  competitorPrices: CompetitorPrice[]
): { min?: number; median?: number } {
  const prices = competitorPrices
    .filter(cp => cp.SKU === sku)
    .map(cp => cp.Price)
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return {};
  }

  const min = prices[0];
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  return { min, median };
}

export interface CompetitorAnalysis {
  min?: number;
  median?: number;
  max?: number;
  safeFloor?: number;
  safeCeiling?: number;
  weight: number;
  count: number;
  recommendation?: string;
}

export function enhanceCompetitorAnalysis(
  sku: string,
  competitorPrices: CompetitorPrice[],
  ctx: PricingContext
): CompetitorAnalysis {
  const prices = competitorPrices
    .filter(cp => cp.SKU === sku)
    .map(cp => cp.Price)
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  const weight = ctx.params.get('COMPETITOR_WEIGHT_PCT') || 30;
  const bandMinPct = ctx.params.get('COMPETITOR_BAND_MIN_PCT') || -15;
  const bandMaxPct = ctx.params.get('COMPETITOR_BAND_MAX_PCT') || 10;

  if (prices.length === 0) {
    return { weight, count: 0 };
  }

  const min = prices[0];
  const max = prices[prices.length - 1];
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  const safeFloor = median * (1 + bandMinPct / 100);
  const safeCeiling = median * (1 + bandMaxPct / 100);

  let recommendation = '';
  if (prices.length >= 3) {
    const spread = ((max - min) / median) * 100;
    if (spread > 30) {
      recommendation = 'High price variance detected. Consider median as anchor.';
    } else if (spread < 10) {
      recommendation = 'Tight competitive pricing. Small adjustments recommended.';
    } else {
      recommendation = 'Moderate competition. Safe to price within band.';
    }
  } else if (prices.length === 1) {
    recommendation = 'Single competitor. Use with caution.';
  }

  return {
    min,
    median,
    max,
    safeFloor,
    safeCeiling,
    weight,
    count: prices.length,
    recommendation
  };
}

export interface PriceSuggestion {
  suggestedUVP: number;
  reason: string;
  isWithinBands: boolean;
  marginAfterAdjustment: number;
  competitorGap?: number;
}

export function suggestPriceAdjustment(
  currentUVP: number,
  landedCost: number,
  competitorAnalysis: CompetitorAnalysis,
  ctx: PricingContext
): PriceSuggestion | null {
  if (!competitorAnalysis.median || !competitorAnalysis.safeFloor || !competitorAnalysis.safeCeiling) {
    return null;
  }

  const floorMargin = ctx.params.get('FLOOR_MARGIN_PCT') || 15;
  const absoluteFloor = landedCost / (1 - floorMargin / 100);

  const { median, safeFloor, safeCeiling, weight } = competitorAnalysis;

  const competitorInfluence = weight / 100;
  const marginInfluence = 1 - competitorInfluence;

  let suggestedUVP: number;
  let reason = 'Current pricing acceptable';
  let isWithinBands = currentUVP >= safeFloor && currentUVP <= safeCeiling;

  if (currentUVP < safeFloor) {
    const weightedSuggestion = (safeFloor * competitorInfluence) + (currentUVP * marginInfluence);
    suggestedUVP = weightedSuggestion;
    reason = `Below safe floor (€${safeFloor.toFixed(2)}). Suggested increase to maintain competitiveness.`;
    isWithinBands = false;
  } else if (currentUVP > safeCeiling) {
    const weightedSuggestion = (safeCeiling * competitorInfluence) + (currentUVP * marginInfluence);
    suggestedUVP = weightedSuggestion;
    reason = `Above safe ceiling (€${safeCeiling.toFixed(2)}). Suggested decrease to stay competitive.`;
    isWithinBands = false;
  } else {
    const weightedSuggestion = (median * competitorInfluence) + (currentUVP * marginInfluence);
    suggestedUVP = weightedSuggestion;
    reason = `Within safe band [€${safeFloor.toFixed(2)} - €${safeCeiling.toFixed(2)}]. Minor adjustment toward median.`;
  }

  // Clamp to safe band (even if weighted blend exceeded it)
  if (suggestedUVP < safeFloor) {
    suggestedUVP = safeFloor;
  } else if (suggestedUVP > safeCeiling) {
    suggestedUVP = safeCeiling;
  }

  // Enforce absolute margin floor
  if (suggestedUVP < absoluteFloor) {
    suggestedUVP = absoluteFloor;
    reason = `Competitor-adjusted price violated margin floor (${floorMargin}%). Using minimum acceptable price.`;
    isWithinBands = false;
  }

  // Recalculate metrics after final adjustments
  const marginAfterAdjustment = ((suggestedUVP - landedCost) / suggestedUVP) * 100;
  const competitorGap = ((suggestedUVP - median) / median) * 100;

  return {
    suggestedUVP: Math.round(suggestedUVP * 100) / 100,
    reason,
    isWithinBands,
    marginAfterAdjustment: Math.round(marginAfterAdjustment * 100) / 100,
    competitorGap: Math.round(competitorGap * 100) / 100
  };
}

export function checkGuardrails(
  uvp: number,
  map: number,
  landedCost: number,
  competitorMin?: number,
  competitorMedian?: number,
  ctx?: PricingContext
): string[] {
  const guardrails: string[] = [];

  const minMarginPct = ctx?.params.get('MIN_MARGIN_PCT') || 10;
  const actualMargin = ((uvp - landedCost) / uvp) * 100;
  
  if (actualMargin < minMarginPct) {
    guardrails.push(`Margin ${actualMargin.toFixed(1)}% below minimum ${minMarginPct}%`);
  }

  if (competitorMin && uvp < competitorMin * 0.95) {
    guardrails.push(`UVP ${uvp.toFixed(2)} is 5%+ below competitor min ${competitorMin.toFixed(2)}`);
  }

  if (competitorMedian && uvp < competitorMedian * 0.90) {
    guardrails.push(`UVP ${uvp.toFixed(2)} is 10%+ below competitor median ${competitorMedian.toFixed(2)}`);
  }

  if (map < landedCost * 1.05) {
    guardrails.push(`MAP ${map.toFixed(2)} too close to landed cost ${landedCost.toFixed(2)}`);
  }

  return guardrails;
}

export function repriceSKU(
  product: FinalPriceList,
  competitorPrices: CompetitorPrice[],
  ctx: PricingContext
): PriceBreakdown {
  let landedCost: number;
  let cogs: number;
  
  // Check if detailed cost breakdown is available (use explicit undefined checks)
  const hasDetailedCosts = (
    product.Factory_Cost_EUR !== undefined ||
    product.Packaging_Cost_EUR !== undefined ||
    product.Freight_kg_EUR !== undefined ||
    product.Import_Duty_Pct !== undefined ||
    product.Overhead_Pct !== undefined
  );
  
  if (hasDetailedCosts) {
    // New detailed calculation
    landedCost = calculateDetailedLandedCost(product, ctx);
    // Preserve base COGS for reporting (sum of factory + packaging only)
    cogs = (product.Factory_Cost_EUR || 0) + (product.Packaging_Cost_EUR || 0);
  } else if (product.COGS_EUR !== undefined) {
    // Legacy calculation
    cogs = product.COGS_EUR;
    const weight = product.Weight_g || 0;
    landedCost = calculateLandedCost(cogs, weight, ctx);
  } else {
    // No cost data available
    cogs = 0;
    landedCost = 0;
  }

  // Calculate channel-specific UVPs
  const channelUVPs = calculateChannelUVPs(landedCost, ctx);
  
  // Use web UVP as recommended UVP (primary channel)
  const uvpRecommended = channelUVPs.uvpWeb;
  
  const map = calculateMAP(uvpRecommended, landedCost, ctx);
  const channelPrices = calculateChannelPrices(uvpRecommended, map, ctx);
  const tierPrices = calculateTierPrices(uvpRecommended, map, ctx);
  const competitorStats = calculateCompetitorStats(product.SKU, competitorPrices);

  const competitorAnalysis = enhanceCompetitorAnalysis(product.SKU, competitorPrices, ctx);
  
  const priceSuggestion = suggestPriceAdjustment(
    uvpRecommended,
    landedCost,
    competitorAnalysis,
    ctx
  );

  const guardrails = checkGuardrails(
    uvpRecommended,
    map,
    landedCost,
    competitorStats.min,
    competitorStats.median,
    ctx
  );

  return {
    sku: product.SKU,
    cogs,
    landedCost,
    uvpRecommended,
    uvpWeb: channelUVPs.uvpWeb,
    uvpSalon: channelUVPs.uvpSalon,
    uvpAmazon: channelUVPs.uvpAmazon,
    map,
    ...channelPrices,
    ...tierPrices,
    competitorMin: competitorStats.min,
    competitorMedian: competitorStats.median,
    competitorAnalysis,
    priceSuggestion,
    guardrails,
  };
}

export function explainPriceCalculation(
  product: FinalPriceList,
  ctx: PricingContext
): string {
  let explanation = `Price Calculation for ${product.SKU} - ${product.Name}\n\n`;
  
  // Check if detailed cost breakdown is available
  const hasDetailedCosts = (
    product.Factory_Cost_EUR !== undefined ||
    product.Packaging_Cost_EUR !== undefined ||
    product.Freight_kg_EUR !== undefined ||
    product.Import_Duty_Pct !== undefined ||
    product.Overhead_Pct !== undefined
  );
  
  let landed: number;
  
  if (hasDetailedCosts) {
    // Detailed cost breakdown explanation
    const factoryCost = product.Factory_Cost_EUR || 0;
    const packagingCost = product.Packaging_Cost_EUR || 0;
    const freightPerKg = product.Freight_kg_EUR || ctx.params.get('DEFAULT_FREIGHT_KG_EUR') || 0;
    const importDutyPct = product.Import_Duty_Pct ?? ctx.params.get('IMPORT_DUTY_PCT_DEFAULT') ?? 0;
    const overheadPct = product.Overhead_Pct ?? ctx.params.get('OVERHEAD_PCT_DEFAULT') ?? 0;
    const weight_kg = (product.Weight_g || 0) / 1000;
    
    explanation += `**Detailed Cost Breakdown:**\n`;
    explanation += `1. Factory Cost: €${factoryCost.toFixed(2)}\n`;
    explanation += `2. Packaging Cost: €${packagingCost.toFixed(2)}\n`;
    let baseCost = factoryCost + packagingCost;
    explanation += `3. Base Cost (Factory + Packaging): €${baseCost.toFixed(2)}\n`;
    
    const freightCost = freightPerKg * weight_kg;
    explanation += `4. Freight: €${freightPerKg.toFixed(2)}/kg × ${weight_kg.toFixed(3)}kg = €${freightCost.toFixed(2)}\n`;
    baseCost += freightCost;
    explanation += `5. Subtotal (before duties): €${baseCost.toFixed(2)}\n`;
    
    landed = baseCost;
    if (importDutyPct > 0) {
      const dutyAmt = baseCost * (importDutyPct / 100);
      explanation += `6. Import Duty (${importDutyPct}%): +€${dutyAmt.toFixed(2)}\n`;
      landed = landed * (1 + importDutyPct / 100);
    }
    
    if (overheadPct > 0) {
      const overheadAmt = landed * (overheadPct / 100);
      explanation += `7. Overhead (${overheadPct}%): +€${overheadAmt.toFixed(2)}\n`;
      landed = landed * (1 + overheadPct / 100);
    }
    
    explanation += `\n**Landed Cost (Total): €${landed.toFixed(2)}**\n\n`;
  } else {
    // Legacy calculation explanation
    const cogs = product.COGS_EUR || 0;
    const weight = product.Weight_g || 0;
    const fulfillBase = ctx.params.get('FULFILL_BASE_EUR') || 0;
    const fulfillPer100g = ctx.params.get('FULFILL_PER_100G_EUR') || 0;
    const returnsPct = ctx.params.get('RETURNS_PCT') || 0;
    const energyPct = ctx.params.get('ENERGY_PCT') || 0;

    explanation += `1. COGS: €${cogs.toFixed(2)}\n`;
    explanation += `2. Fulfillment Base: €${fulfillBase.toFixed(2)}\n`;
    explanation += `3. Fulfillment per 100g: €${fulfillPer100g.toFixed(2)} × ${(weight / 100).toFixed(2)} = €${((weight / 100) * fulfillPer100g).toFixed(2)}\n`;
    
    landed = cogs + fulfillBase + (weight / 100) * fulfillPer100g;
    explanation += `4. Subtotal: €${landed.toFixed(2)}\n`;

    if (returnsPct > 0) {
      const returnsAmt = landed * (returnsPct / 100);
      explanation += `5. Returns (${returnsPct}%): +€${returnsAmt.toFixed(2)}\n`;
      landed += returnsAmt;
    }

    if (energyPct > 0) {
      const energyAmt = landed * (energyPct / 100);
      explanation += `6. Energy (${energyPct}%): +€${energyAmt.toFixed(2)}\n`;
      landed += energyAmt;
    }

    explanation += `\n**Landed Cost: €${landed.toFixed(2)}**\n\n`;
  }
  
  // Multi-channel UVP calculation
  const channelUVPs = calculateChannelUVPs(landed, ctx);
  
  const webMargin = ctx.params.get('TARGET_MARGIN_WEB_PCT') || 
                    ctx.params.get('MARGIN_UVP_PCT') || 50;
  const webRounding = ctx.params.get('RND_UVP_WEB') || 0.49;
  
  const salonMargin = ctx.params.get('TARGET_MARGIN_SALON_PCT') || 
                      ctx.params.get('MARGIN_UVP_PCT') || 40;
  const salonRounding = ctx.params.get('RND_UVP_SALON') || 0.99;
  
  explanation += `**Multi-Channel UVP Calculation:**\n`;
  explanation += `\n• Web Channel:\n`;
  explanation += `  Target Margin: ${webMargin}%\n`;
  explanation += `  Base UVP = €${landed.toFixed(2)} / (1 - ${webMargin / 100}) = €${(landed / (1 - webMargin/100)).toFixed(2)}\n`;
  explanation += `  Price Ending: .${(webRounding * 100).toFixed(0)}\n`;
  explanation += `  **Final Web UVP: €${channelUVPs.uvpWeb.toFixed(2)}**\n`;
  
  explanation += `\n• Salon/B2B Channel:\n`;
  explanation += `  Target Margin: ${salonMargin}%\n`;
  explanation += `  Base UVP = €${landed.toFixed(2)} / (1 - ${salonMargin / 100}) = €${(landed / (1 - salonMargin/100)).toFixed(2)}\n`;
  explanation += `  Price Ending: .${(salonRounding * 100).toFixed(0)}\n`;
  explanation += `  **Final Salon UVP: €${channelUVPs.uvpSalon.toFixed(2)}**\n`;
  
  explanation += `\n• Amazon Channel:\n`;
  explanation += `  Uses Web pricing: €${channelUVPs.uvpAmazon.toFixed(2)}\n`;
  
  explanation += `\n**Primary Recommended UVP (Web): €${channelUVPs.uvpWeb.toFixed(2)}**\n`;

  const map = calculateMAP(channelUVPs.uvpWeb, landed, ctx);
  explanation += `\n**MAP (Minimum Advertised Price): €${map.toFixed(2)}**\n`;

  return explanation;
}
