/**
 * HAIROTICMEN Pricing Engine V2
 * Complete pricing calculation system for German B2B/B2C market
 * 
 * Features:
 * - Config-driven architecture
 * - Multi-line product support (Premium, Skin, Professional, Basic, Tools)
 * - Partner role pricing with caps and discounts
 * - Quantity and order-level discounts
 * - Channel guardrails (OwnStore, Amazon FBM/FBA)
 * - Loyalty system integration
 * - Gift costs and box costs
 * - FBA fee calculations
 * - Consumer price rounding (.99)
 * - Grundpreis (€/L) calculations
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// ============================================================================
// ENHANCED TYPE DEFINITIONS - V2.1
// ============================================================================

/**
 * Tiered referral configuration for Amazon
 * Allows different referral % based on price thresholds
 */
export interface TieredReferral {
  maxInc: number | null;  // null means no upper limit
  pct: number;
}

/**
 * Enhanced channel configuration with tiered referral support (V2.2)
 */
export interface ChannelConfig {
  referralPct: number;           // Fallback referral percentage
  platformPct: number;            // Platform fee percentage
  labelFee: number;               // Fixed label fee in EUR
  applyPaymentFee: boolean;       // Whether to apply payment processing fee
  minReferralFeeEur?: number;     // Minimum referral fee in EUR (Amazon: 0.30€)
  tieredReferral?: TieredReferral[];  // Tiered referral structure
  adPctOverride?: { [line: string]: number };  // V2.2: Channel-specific ad % by product line
  avgUnitsPerOrderDefault?: number;  // V2.2: Default units per order for this channel
}

/**
 * Partner role configuration
 */
export interface RoleConfig {
  discount: number;      // Base discount percentage
  cap: number;          // Maximum discount cap
  minEur: number;       // Minimum margin in EUR
  commissionPct: number; // Off-invoice commission percentage
}

/**
 * Product line configuration
 */
export interface LineConfig {
  gmUvp: number;      // Target gross margin for UVP
  adPct: number;      // Advertising cost percentage
  floorMult: number;  // Floor price multiplier
}

/**
 * Amazon FBA size tier configuration
 */
export interface AmazonSizeTier {
  pickPack: number;
  weight: number;
  storage: number;
  labelPrep: number;
  returnsPct: number;
}

/**
 * Main pricing configuration
 */
export interface PricingConfig {
  version: string;
  effectiveDate: string;
  description: string;
  vat: number;
  fxBufferPct: number;
  targetPostChannelMargin: number;
  returnsPct: number;
  paymentFeePct: number;
  consumerRoundTo: number;
  loyalty: {
    pointsPerEuro: number;
    pointValueEur: number;
    expectedRedemption: number;
  };
  productLines: {
    [key: string]: LineConfig;
  };
  partnerRoles: {
    [key: string]: RoleConfig;
  };
  quantityDiscounts: Array<{
    min: number;
    max: number;
    pct: number;
  }>;
  orderDiscounts: Array<{
    minSubtotalNet: number;
    pct: number;
  }>;
  channels: {
    [key: string]: ChannelConfig;
  };
  amazonSizeTiers: {
    [key: string]: AmazonSizeTier;
  };
  boxCosts: {
    [key: string]: number;
  };
  avgUnitsPerOrder: {
    B2C: number;
    B2B: number;
  };
  gwpDefaults?: {  // V2.2: Gift with Purchase defaults
    fundingPct: number;    // % of gift cost funded by marketing/partner budget
    attachRate: number;    // Expected gift attachment rate
  };
}

export interface ProductInput {
  sku: string;
  line: string;
  factoryUnitManual?: number;
  totalFactoryCarton?: number;
  unitsPerCarton?: number;
  shippingInboundPerUnit: number;
  eprLucid: number;
  gs1: number;
  retailPackaging: number;
  qcPif: number;
  operations: number;
  marketing: number;
  netContentMl?: number;
  boxSize?: string;
  giftSkuCost?: number;
  giftAttachRate?: number;
  giftFundingPct?: number;
  giftShippingIncrement?: number;
  manualUvpInc?: number;
  amazonTierKey?: string;
}

export interface ProductPricingResult {
  // Input identifiers
  sku: string;
  line: string;
  
  // Cost breakdown
  factoryUnit: number;
  factoryUnitFinal: number;
  fullCostUnit: number;
  
  // Pricing
  floorB2CNet: number;
  uvpNet: number;
  uvpInc: number;
  uvpInc99: number;
  uvpVsFloorFlag: string;
  
  // Grundpreis
  grundpreisIncPerL?: number;
  
  // Gift & Box costs
  giftCostExpectedUnit: number;
  boxCostPerUnit: number;
  
  // Guardrails per channel
  guardrails: {
    OwnStore: number;
    Amazon_FBM: number;
    Amazon_FBA: number;
  };
  
  // Additional data
  adPct: number;
  targetMargin: number;
  
  // V2.2: Autotune recommendations
  autotuneAction?: 'OK' | 'RAISE_UVP' | 'BUNDLE_RECOMMENDED';
  autotuneOriginalUvpInc99?: number;  // Original UVP before autotune
  autotunePctIncrease?: number;        // % increase applied
}

export interface LineItem {
  product: ProductInput;
  qty: number;
}

export interface QuoteResult {
  lines: Array<{
    sku: string;
    name: string;
    qty: number;
    unitNet: number;
    lineNet: number;
    uvpInc99: number;
  }>;
  subtotalNet: number;
  orderDiscountPct: number;
  subtotalNetAfterDisc: number;
  vatEur: number;
  shippingEur: number;
  totalGross: number;
  loyaltyPoints: number;
  commissions: { [role: string]: number };
  guardrails: { [sku: string]: { [channel: string]: number } };
}

// ============================================================================
// PRICING ENGINE CLASS
// ============================================================================

class PricingEngineV2 {
  private config: PricingConfig;

  constructor(configPath?: string) {
    const defaultPath = path.join(process.cwd(), 'server/config/hairoticmen-pricing.json');
    const actualPath = configPath || defaultPath;
    
    const configData = fs.readFileSync(actualPath, 'utf-8');
    this.config = JSON.parse(configData);
  }

  /**
   * Get configuration (read-only)
   */
  getConfig(): Readonly<PricingConfig> {
    return this.config;
  }

  /**
   * Normalize product line name for consistent lookups
   */
  private normalizeProductLine(line: string): string {
    const normalized = line.trim();
    const titleCase = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
    return titleCase;
  }

  /**
   * Round consumer price to .99
   */
  private roundConsumer(price: number): number {
    return Math.floor(price) + this.config.consumerRoundTo;
  }

  /**
   * Calculate loyalty cost as percentage
   */
  private loyaltyCostPct(): number {
    const { pointsPerEuro, pointValueEur, expectedRedemption } = this.config.loyalty;
    return pointsPerEuro * pointValueEur * expectedRedemption;
  }

  /**
   * Calculate dynamic referral percentage based on price tier
   * Amazon uses 8% for prices ≤ €10, 15% for prices > €10
   * 
   * @param channel - Channel configuration
   * @param endUserInc - End user price including VAT
   * @returns Referral percentage to apply
   */
  private referralPctForPrice(channel: ChannelConfig, endUserInc: number): number {
    if (!channel.tieredReferral || channel.tieredReferral.length === 0) {
      return channel.referralPct;
    }
    
    for (const tier of channel.tieredReferral) {
      if (tier.maxInc === null || endUserInc <= tier.maxInc) {
        return tier.pct;
      }
    }
    
    return channel.referralPct;
  }

  /**
   * Calculate actual referral cost in EUR with minimum fee
   * 
   * @param channel - Channel configuration
   * @param endUserInc - End user price including VAT
   * @returns Referral cost in EUR
   */
  private referralCostEur(channel: ChannelConfig, endUserInc: number): number {
    const pct = this.referralPctForPrice(channel, endUserInc);
    const fee = endUserInc * pct;
    return Math.max(fee, channel.minReferralFeeEur ?? 0);
  }

  /**
   * Get quantity discount for given quantity
   */
  private getQtyDiscount(qty: number): number {
    for (const bracket of this.config.quantityDiscounts) {
      if (qty >= bracket.min && qty <= bracket.max) {
        return bracket.pct;
      }
    }
    return 0.0;
  }

  /**
   * Get order-level discount for given subtotal
   */
  private getOrderDiscount(subtotalNet: number): number {
    let maxPct = 0.0;
    for (const rule of this.config.orderDiscounts) {
      if (subtotalNet >= rule.minSubtotalNet) {
        maxPct = Math.max(maxPct, rule.pct);
      }
    }
    return maxPct;
  }

  /**
   * Get FBA fees for given tier key
   */
  private getFbaFees(tierKey?: string): number {
    if (!tierKey) return 0.0;
    
    const tier = this.config.amazonSizeTiers[tierKey];
    if (!tier) return 0.0;
    
    return tier.pickPack + tier.weight + tier.storage + tier.labelPrep;
  }

  /**
   * Calculate factory unit price (final with FX buffer)
   */
  private calculateFactoryUnit(product: ProductInput): number {
    let baseFactory = 0;
    
    if (product.factoryUnitManual && product.factoryUnitManual > 0) {
      baseFactory = product.factoryUnitManual;
    } else if (product.totalFactoryCarton && product.unitsPerCarton && product.unitsPerCarton > 0) {
      baseFactory = product.totalFactoryCarton / product.unitsPerCarton;
    }
    
    return baseFactory * (1 + this.config.fxBufferPct);
  }

  /**
   * Calculate full cost per unit
   */
  private calculateFullCost(product: ProductInput, factoryFinal: number): number {
    return factoryFinal 
      + product.shippingInboundPerUnit
      + product.eprLucid
      + product.gs1
      + product.retailPackaging
      + product.qcPif
      + product.operations
      + product.marketing;
  }

  /**
   * Calculate gift cost expected per unit
   */
  private calculateGiftCost(product: ProductInput): number {
    if (!product.giftSkuCost || !product.giftAttachRate) return 0.0;
    
    const giftFunding = product.giftFundingPct || 0;
    const giftShipping = product.giftShippingIncrement || 0;
    
    return (product.giftSkuCost * (1 - giftFunding) + giftShipping) * product.giftAttachRate;
  }

  /**
   * Calculate box cost per unit
   */
  private calculateBoxCost(product: ProductInput, orderType: 'B2C' | 'B2B' = 'B2C'): number {
    if (!product.boxSize) return 0.0;
    
    const boxCost = this.config.boxCosts[product.boxSize] || 0;
    const avgUnits = this.config.avgUnitsPerOrder[orderType];
    
    return boxCost / Math.max(1, avgUnits);
  }

  /**
   * Calculate UVP (Net and Inc)
   */
  private calculateUVP(product: ProductInput, fullCost: number, line: string): {
    uvpNet: number;
    uvpInc: number;
    uvpInc99: number;
  } {
    const lineConfig = this.config.productLines[line];
    if (!lineConfig) {
      throw new Error(`Unknown product line: ${line}`);
    }

    let uvpNet = 0;
    
    if (product.manualUvpInc && product.manualUvpInc > 0) {
      uvpNet = product.manualUvpInc / (1 + this.config.vat);
    } else {
      uvpNet = fullCost / Math.max(0.01, 1 - lineConfig.gmUvp);
    }
    
    const uvpInc = uvpNet * (1 + this.config.vat);
    const uvpInc99 = this.roundConsumer(uvpInc);
    
    return { uvpNet, uvpInc, uvpInc99 };
  }

  /**
   * V2.2: Autotune UVP to meet guardrail coverage
   * 
   * Automatically raises UVP up to +25% if guardrails exceed UVP
   * Beyond +25%, recommends bundling strategy
   * 
   * @param uvpInc99 - Original UVP with .99 rounding
   * @param guardrails - Channel guardrails object
   * @returns Autotune result with action and adjusted UVP
   */
  private autotuneUvpInc99(
    uvpInc99: number,
    guardrails: { OwnStore: number; Amazon_FBM: number; Amazon_FBA: number }
  ): {
    uvpInc99: number;
    action: 'OK' | 'RAISE_UVP' | 'BUNDLE_RECOMMENDED';
    originalUvp?: number;
    pctIncrease?: number;
  } {
    const minAll = Math.max(
      guardrails.OwnStore || 0,
      guardrails.Amazon_FBM || 0,
      guardrails.Amazon_FBA || 0
    );
    
    // If no guardrails or UVP already meets all guardrails, no action needed
    if (minAll === 0 || uvpInc99 >= minAll) {
      return { uvpInc99, action: 'OK' };
    }
    
    // Calculate % increase needed
    const neededPct = (minAll / uvpInc99) - 1;
    
    // If increase needed is ≤25%, auto-raise UVP
    if (neededPct <= 0.25) {
      const raised = Math.floor(minAll) + this.config.consumerRoundTo;
      return {
        uvpInc99: raised,
        action: 'RAISE_UVP',
        originalUvp: uvpInc99,
        pctIncrease: ((raised / uvpInc99) - 1) * 100
      };
    }
    
    // If increase needed is >25%, recommend bundling
    return {
      uvpInc99: uvpInc99,  // Keep original UVP
      action: 'BUNDLE_RECOMMENDED',
      originalUvp: uvpInc99,
      pctIncrease: neededPct * 100
    };
  }

  /**
   * Calculate guardrail (minimum price) for a channel with iterative tiered referral
   * 
   * Guardrail ensures that after all channel costs, we still achieve
   * the target post-channel margin (default 45%)
   * 
   * Formula: MinPrice_Net = FixedCosts / (1 - VariableCosts% - TargetMargin%)
   * 
   * V2.1: Iteratively calculates tiered referral for Amazon (8% ≤€10, 15% >€10 + €0.30 min)
   * V2.2: Supports channel-specific ad% via adPctOverride
   */
  private calculateGuardrail(
    channel: string,
    fullCost: number,
    boxCost: number,
    giftCost: number,
    adPct: number,
    uvpInc: number,  // Initial guess for tiered referral
    tierKey?: string,
    productLine?: string  // V2.2: For ad% override
  ): number {
    const ch = this.config.channels[channel];
    if (!ch) {
      throw new Error(`Unknown channel: ${channel}`);
    }

    // V2.2: Use channel-specific ad% override if available
    let effectiveAdPct = adPct;
    if (ch.adPctOverride && productLine && ch.adPctOverride[productLine] !== undefined) {
      effectiveAdPct = ch.adPctOverride[productLine];
    }

    // Fixed costs (absolute EUR per unit)
    let fixedCosts = fullCost + boxCost + giftCost + ch.labelFee;
    
    // Add FBA specific fees if applicable
    if (channel === 'Amazon_FBA') {
      fixedCosts += this.getFbaFees(tierKey);
    }

    // For Amazon channels with tiered referral, iterate to find correct tier
    if (channel.includes('Amazon') && ch.tieredReferral && ch.tieredReferral.length > 0) {
      return this.calculateGuardrailWithTieredReferral(
        channel, ch, fixedCosts, effectiveAdPct, uvpInc
      );
    }

    // For non-Amazon or channels without tiered referral, use simple calculation
    let varCosts = effectiveAdPct + ch.referralPct + ch.platformPct;
    
    if (ch.applyPaymentFee) {
      varCosts += this.config.paymentFeePct;
    }
    
    if (channel === 'OwnStore') {
      varCosts += this.config.returnsPct;
      varCosts += this.loyaltyCostPct();
    }

    const denominator = 1 - varCosts - this.config.targetPostChannelMargin;
    
    if (denominator <= 0.01) {
      console.warn(`⚠️  UNFEASIBLE GUARDRAIL for channel ${channel}:`);
      console.warn(`   Variable costs: ${(varCosts * 100).toFixed(1)}%`);
      console.warn(`   Target margin: ${(this.config.targetPostChannelMargin * 100).toFixed(1)}%`);
      return 999.99;
    }
    
    const minNetRequired = fixedCosts / denominator;
    const minIncRequired = minNetRequired * (1 + this.config.vat);
    
    return this.roundConsumer(minIncRequired);
  }

  /**
   * Calculate guardrail with tiered referral (iterative approach)
   * Iterates to ensure the correct tier is applied based on final guardrail price
   */
  private calculateGuardrailWithTieredReferral(
    channel: string,
    ch: ChannelConfig,
    fixedCosts: number,
    adPct: number,
    uvpInc: number
  ): number {
    const maxIterations = 5;
    let currentGuess = uvpInc;
    
    for (let i = 0; i < maxIterations; i++) {
      // Calculate referral % based on current guess
      const referralPct = this.referralPctForPrice(ch, currentGuess);
      
      // Build variable costs
      let varCosts = adPct + referralPct + ch.platformPct;
      
      if (ch.applyPaymentFee) {
        varCosts += this.config.paymentFeePct;
      }
      
      // Amazon channels have returns and loyalty
      varCosts += this.config.returnsPct;
      varCosts += this.loyaltyCostPct();
      
      // Calculate denominator
      const denominator = 1 - varCosts - this.config.targetPostChannelMargin;
      
      if (denominator <= 0.01) {
        console.warn(`⚠️  UNFEASIBLE GUARDRAIL for channel ${channel}:`);
        console.warn(`   Variable costs: ${(varCosts * 100).toFixed(1)}%`);
        console.warn(`   Target margin: ${(this.config.targetPostChannelMargin * 100).toFixed(1)}%`);
        return 999.99;
      }
      
      // Calculate new guardrail price
      const minNetRequired = fixedCosts / denominator;
      const minIncRequired = minNetRequired * (1 + this.config.vat);
      const newGuess = Math.floor(minIncRequired) + this.config.consumerRoundTo;
      
      // Check if we've converged (within €0.01)
      if (Math.abs(newGuess - currentGuess) < 0.01) {
        return newGuess;
      }
      
      currentGuess = newGuess;
    }
    
    // If we didn't converge, return last guess
    return currentGuess;
  }

  /**
   * Calculate complete product pricing
   */
  calculateProductPricing(product: ProductInput): ProductPricingResult {
    const normalizedLine = this.normalizeProductLine(product.line);
    const lineConfig = this.config.productLines[normalizedLine];
    
    if (!lineConfig) {
      throw new Error(`Unknown product line: ${product.line} (normalized: ${normalizedLine})`);
    }

    // Step 1: Factory cost
    const factoryUnit = product.factoryUnitManual || 
      (product.totalFactoryCarton && product.unitsPerCarton 
        ? product.totalFactoryCarton / product.unitsPerCarton 
        : 0);
    const factoryUnitFinal = this.calculateFactoryUnit(product);

    // Step 2: Full cost
    const fullCostUnit = this.calculateFullCost(product, factoryUnitFinal);

    // Step 3: Floor
    const floorB2CNet = fullCostUnit * lineConfig.floorMult;

    // Step 4: UVP
    const { uvpNet, uvpInc, uvpInc99 } = this.calculateUVP(product, fullCostUnit, normalizedLine);

    // Step 5: UVP vs Floor check
    const uvpVsFloorFlag = uvpNet >= floorB2CNet ? 'OK' : 'RAISE_UVP';

    // Step 6: Grundpreis
    let grundpreisIncPerL: number | undefined;
    if (product.netContentMl && product.netContentMl > 0) {
      grundpreisIncPerL = uvpInc99 / (product.netContentMl / 1000);
    }

    // Step 7: Gift and box costs
    const giftCostExpectedUnit = this.calculateGiftCost(product);
    const boxCostPerUnit = this.calculateBoxCost(product, 'B2C');

    // Step 8: Guardrails (using UVP for tiered referral calculation, V2.2: with line-specific ad%)
    const guardrails = {
      OwnStore: this.calculateGuardrail('OwnStore', fullCostUnit, boxCostPerUnit, giftCostExpectedUnit, lineConfig.adPct, uvpInc, product.amazonTierKey, normalizedLine),
      Amazon_FBM: this.calculateGuardrail('Amazon_FBM', fullCostUnit, boxCostPerUnit, giftCostExpectedUnit, lineConfig.adPct, uvpInc, product.amazonTierKey, normalizedLine),
      Amazon_FBA: this.calculateGuardrail('Amazon_FBA', fullCostUnit, boxCostPerUnit, giftCostExpectedUnit, lineConfig.adPct, uvpInc, product.amazonTierKey, normalizedLine),
    };

    // V2.2: Step 9: Autotune UVP if needed
    const autotuneResult = this.autotuneUvpInc99(uvpInc99, guardrails);
    const finalUvpInc99 = autotuneResult.uvpInc99;
    const finalUvpInc = finalUvpInc99 / (1 + this.config.vat) * (1 + this.config.vat); // Recalculate without rounding
    const finalUvpNet = finalUvpInc99 / (1 + this.config.vat);

    // Update grundpreis if UVP changed
    if (product.netContentMl && product.netContentMl > 0) {
      grundpreisIncPerL = finalUvpInc99 / (product.netContentMl / 1000);
    }

    return {
      sku: product.sku,
      line: normalizedLine,
      factoryUnit,
      factoryUnitFinal,
      fullCostUnit,
      floorB2CNet,
      uvpNet: finalUvpNet,
      uvpInc: finalUvpInc,
      uvpInc99: finalUvpInc99,
      uvpVsFloorFlag,
      grundpreisIncPerL,
      giftCostExpectedUnit,
      boxCostPerUnit,
      guardrails,
      adPct: lineConfig.adPct,
      targetMargin: lineConfig.gmUvp,
      autotuneAction: autotuneResult.action,
      autotuneOriginalUvpInc99: autotuneResult.originalUvp,
      autotunePctIncrease: autotuneResult.pctIncrease,
    };
  }

  /**
   * Calculate partner unit net price
   */
  calculatePartnerUnitNet(
    uvpNet: number,
    floorNet: number,
    fullCost: number,
    role: string,
    qty: number
  ): number {
    const roleConfig = this.config.partnerRoles[role];
    if (!roleConfig) {
      throw new Error(`Unknown partner role: ${role}`);
    }

    // Apply role discount
    const priceAfterRole = uvpNet * (1 - roleConfig.discount);

    // Apply quantity discount (skip for Distributor)
    const qtyDisc = role === 'Distributor' ? 0 : this.getQtyDiscount(qty);
    const priceAfterQty = priceAfterRole * (1 - qtyDisc);

    // Apply cap and floor constraints
    const capPrice = uvpNet * (1 - roleConfig.cap);
    const minEurFloor = fullCost + roleConfig.minEur;

    return Math.max(priceAfterQty, capPrice, floorNet, minEurFloor);
  }

  /**
   * Build complete quote with all calculations
   */
  buildQuote(
    items: LineItem[],
    role: string,
    channel: string,
    shippingOutboundEur: number,
    vatMode: '19%' | '0%' = '19%'
  ): QuoteResult {
    const lines: QuoteResult['lines'] = [];
    let subtotal = 0;
    const guardrails: QuoteResult['guardrails'] = {};

    // Process each line item
    for (const item of items) {
      const pricing = this.calculateProductPricing(item.product);
      const unitNet = this.calculatePartnerUnitNet(
        pricing.uvpNet,
        pricing.floorB2CNet,
        pricing.fullCostUnit,
        role,
        item.qty
      );
      const lineNet = unitNet * item.qty;
      subtotal += lineNet;

      guardrails[item.product.sku] = pricing.guardrails;

      lines.push({
        sku: item.product.sku,
        name: item.product.sku,
        qty: item.qty,
        unitNet: Math.round(unitNet * 100) / 100,
        lineNet: Math.round(lineNet * 100) / 100,
        uvpInc99: pricing.uvpInc99,
      });
    }

    // Apply order discount
    const orderDiscPct = this.getOrderDiscount(subtotal);
    const subtotalAfterDisc = subtotal * (1 - orderDiscPct);

    // Calculate VAT
    const vatPct = vatMode === '19%' ? this.config.vat : 0;
    const vatEur = subtotalAfterDisc * vatPct;

    // Total
    const totalGross = subtotalAfterDisc + vatEur + shippingOutboundEur;

    // Loyalty points (B2C only - exclude dealers)
    const b2bRoles = ['Dealer Basic', 'Dealer Plus', 'Stand Program', 'Distributor'];
    const loyaltyPoints = b2bRoles.includes(role) 
      ? 0 
      : subtotalAfterDisc * this.config.loyalty.pointsPerEuro;

    // Commissions
    const commissions: { [role: string]: number } = {};
    const roleConfig = this.config.partnerRoles[role];
    if (roleConfig && roleConfig.commissionPct > 0) {
      commissions[role] = Math.round(subtotalAfterDisc * roleConfig.commissionPct * 100) / 100;
    }

    return {
      lines,
      subtotalNet: Math.round(subtotal * 100) / 100,
      orderDiscountPct: orderDiscPct,
      subtotalNetAfterDisc: Math.round(subtotalAfterDisc * 100) / 100,
      vatEur: Math.round(vatEur * 100) / 100,
      shippingEur: Math.round(shippingOutboundEur * 100) / 100,
      totalGross: Math.round(totalGross * 100) / 100,
      loyaltyPoints: Math.round(loyaltyPoints),
      commissions,
      guardrails,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

let engineInstance: PricingEngineV2 | null = null;

/**
 * Get singleton pricing engine instance (loads config once)
 */
export function getPricingEngine(): PricingEngineV2 {
  if (!engineInstance) {
    engineInstance = new PricingEngineV2();
  }
  return engineInstance;
}

/**
 * Create new pricing engine instance with custom config path
 */
export function createPricingEngine(configPath?: string): PricingEngineV2 {
  return new PricingEngineV2(configPath);
}

// Re-export class for direct instantiation if needed
export { PricingEngineV2 };
