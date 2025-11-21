import type { 
  FinalPriceList, PartnerRegistry, SalonSubscription, Bundle, GiftBank,
  CommissionRule, PricingParam, PartnerTier
} from '@shared/schema';
import { calculateTierPrices, calculateMAP, type PricingContext } from './pricing';

export interface AdvancedPricingContext extends PricingContext {
  subscriptions: Map<string, SalonSubscription>;
  bundles: Map<string, Bundle>;
  gifts: GiftBank[];
  commissionRules: CommissionRule[];
  volumeLadder: VolumeDiscount[];
  loyaltyEarnRate: number;
  loyaltyRedeemRate: number;
}

export interface VolumeDiscount {
  minOrderEUR: number;
  maxOrderEUR?: number;
  discountPct: number;
}

export interface LineItemPricing {
  sku: string;
  qty: number;
  unitPrice: number;
  tierDiscount: number;
  lineTotal: number;
  appliedMAP: boolean;
}

export interface InvoicePricing {
  lines: LineItemPricing[];
  subtotalGross: number;
  tierDiscountTotal: number;
  volumeDiscountPct: number;
  volumeDiscountAmt: number;
  subscriptionDiscountPct: number;
  subscriptionDiscountAmt: number;
  subtotalAfterDiscounts: number;
  loyaltyRedeemed: number;
  finalTotal: number;
  vatRate: number;
  vatAmount: number;
  finalTotalWithVAT: number;
  loyaltyEarned: number;
  eligibleGifts: string[];
  commissions: CommissionBreakdown[];
  mapViolations: string[];
  marginGuardrails: string[];
}

export interface CommissionBreakdown {
  type: 'SalesRep' | 'Affiliate';
  owner: string;
  baseAmount: number;
  ratePct: number;
  commissionAmt: number;
}

export function buildAdvancedContext(
  params: PricingParam[],
  tiers: PartnerTier[],
  subscriptions: SalonSubscription[],
  bundles: Bundle[],
  gifts: GiftBank[],
  commissionRules: CommissionRule[]
): AdvancedPricingContext {
  const paramsMap = new Map<string, number>();
  params.forEach(p => {
    const numValue = parseFloat(p.Value);
    if (!isNaN(numValue)) {
      paramsMap.set(p.ParamKey, numValue);
    }
  });

  const tiersMap = new Map<string, PartnerTier>();
  tiers.forEach(t => tiersMap.set(t.Tier, t));

  const subscriptionsMap = new Map<string, SalonSubscription>();
  subscriptions
    .filter(s => s.Status === 'Active')
    .forEach(s => subscriptionsMap.set(s.PartnerID, s));

  const bundlesMap = new Map<string, Bundle>();
  bundles
    .filter(b => b.Active !== false)
    .forEach(b => bundlesMap.set(b.BundleID, b));

  const volumeLadder: VolumeDiscount[] = [
    { minOrderEUR: 500, maxOrderEUR: 999, discountPct: 5 },
    { minOrderEUR: 1000, maxOrderEUR: 2499, discountPct: 10 },
    { minOrderEUR: 2500, discountPct: 15 }
  ];

  const loyaltyEarnRate = paramsMap.get('LOYALTY_EARN_PCT') || 1;
  const loyaltyRedeemRate = paramsMap.get('LOYALTY_REDEEM_RATE') || 0.10;

  return {
    params: paramsMap,
    tiers: tiersMap,
    subscriptions: subscriptionsMap,
    bundles: bundlesMap,
    gifts: gifts.filter(g => g.Active !== false),
    commissionRules,
    volumeLadder,
    loyaltyEarnRate,
    loyaltyRedeemRate
  };
}

export function calculateVolumeDiscount(
  subtotal: number,
  volumeLadder: VolumeDiscount[]
): { discountPct: number; discountAmt: number } {
  let discountPct = 0;

  for (const tier of volumeLadder) {
    if (subtotal >= tier.minOrderEUR) {
      if (!tier.maxOrderEUR || subtotal <= tier.maxOrderEUR) {
        discountPct = tier.discountPct;
        break;
      }
    }
  }

  const discountAmt = (subtotal * discountPct) / 100;
  return { discountPct, discountAmt };
}

export function calculateSubscriptionDiscount(
  partnerID: string,
  subtotal: number,
  ctx: AdvancedPricingContext
): { discountPct: number; discountAmt: number } {
  const subscription = ctx.subscriptions.get(partnerID);
  
  if (!subscription || subscription.Status !== 'Active') {
    return { discountPct: 0, discountAmt: 0 };
  }

  const discountPct = subscription.DiscountPct || 0;
  const discountAmt = (subtotal * discountPct) / 100;

  return { discountPct, discountAmt };
}

export function detectEligibleGifts(
  orderTotal: number,
  gifts: GiftBank[]
): string[] {
  return gifts
    .filter(g => g.Active !== false && orderTotal >= g.Threshold_EUR)
    .sort((a, b) => b.Threshold_EUR - a.Threshold_EUR)
    .map(g => g.SKU);
}

export function calculateLoyaltyEarned(
  finalTotal: number,
  earnRate: number
): number {
  const pointsEarned = Math.floor(finalTotal * earnRate / 10);
  return pointsEarned;
}

export function calculateLoyaltyRedemption(
  requestedRedeem: number,
  availablePoints: number,
  orderSubtotal: number,
  redeemRate: number
): { pointsRedeemed: number; amountRedeemed: number } {
  const maxPoints = Math.min(requestedRedeem, availablePoints);
  const maxAmountByPoints = maxPoints * redeemRate;
  const maxAmountByOrder = orderSubtotal * 0.5;

  const amountRedeemed = Math.min(maxAmountByPoints, maxAmountByOrder);
  const pointsRedeemed = Math.floor(amountRedeemed / redeemRate);

  return { pointsRedeemed, amountRedeemed };
}

export function calculateCommissions(
  orderTotal: number,
  partnerID: string,
  salesRep: string | undefined,
  affiliateID: string | undefined,
  commissionRules: CommissionRule[]
): CommissionBreakdown[] {
  const commissions: CommissionBreakdown[] = [];

  if (salesRep) {
    const salesRepRule = commissionRules.find(
      r => r.Role === 'SalesRep' && (!r.Channel || r.Channel === 'all')
    );

    if (salesRepRule) {
      const ratePct = salesRepRule.BaseRatePct || 0;
      const capPct = salesRepRule.CapPct || 100;
      const effectiveRate = Math.min(ratePct, capPct);
      const commissionAmt = (orderTotal * effectiveRate) / 100;

      commissions.push({
        type: 'SalesRep',
        owner: salesRep,
        baseAmount: orderTotal,
        ratePct: effectiveRate,
        commissionAmt
      });
    }
  }

  if (affiliateID) {
    const affiliateRule = commissionRules.find(
      r => r.Role === 'Affiliate' && (!r.Channel || r.Channel === 'all')
    );

    if (affiliateRule) {
      const ratePct = affiliateRule.BaseRatePct || 0;
      const capPct = affiliateRule.CapPct || 100;
      const effectiveRate = Math.min(ratePct, capPct);
      const commissionAmt = (orderTotal * effectiveRate) / 100;

      commissions.push({
        type: 'Affiliate',
        owner: affiliateID,
        baseAmount: orderTotal,
        ratePct: effectiveRate,
        commissionAmt
      });
    }
  }

  return commissions;
}

export interface BundleMatch {
  bundleID: string;
  bundleName: string;
  skus: string[];
  totalQty: number;
  originalTotal: number;
  bundlePrice: number;
  bundleDiscount: number;
}

export function calculateOrderPricing(
  partner: PartnerRegistry,
  lineItems: { sku: string; qty: number; product: FinalPriceList }[],
  loyaltyPointsAvailable: number,
  loyaltyPointsToRedeem: number,
  salesRep: string | undefined,
  affiliateID: string | undefined,
  ctx: AdvancedPricingContext
): InvoicePricing {
  const lines: LineItemPricing[] = [];
  let subtotalGross = 0;
  let tierDiscountTotal = 0;
  const mapViolations: string[] = [];

  const partnerTier = partner.Tier || 'Basic';
  const tierData = ctx.tiers.get(partnerTier);
  const tierDiscountPct = tierData?.DiscountPct || 0;

  const remainingQty = new Map<string, number>();
  lineItems.forEach(item => remainingQty.set(item.sku, item.qty));

  for (const bundle of ctx.bundles.values()) {
    try {
      const bundleItems: { SKU: string; Qty: number }[] = JSON.parse(bundle.ItemsJSON);
      
      let maxBundleSets = Infinity;
      for (const bundleItem of bundleItems) {
        const available = remainingQty.get(bundleItem.SKU) || 0;
        const setsFromThisSKU = Math.floor(available / bundleItem.Qty);
        maxBundleSets = Math.min(maxBundleSets, setsFromThisSKU);
      }

      if (maxBundleSets > 0 && maxBundleSets < Infinity) {
        let bundleGrossPerSet = 0;

        for (const bundleItem of bundleItems) {
          const lineItem = lineItems.find(li => li.sku === bundleItem.SKU);
          if (!lineItem) continue;

          const uvp = lineItem.product.UVP || 0;
          bundleGrossPerSet += uvp * bundleItem.Qty;

          const consumed = bundleItem.Qty * maxBundleSets;
          const remaining = (remainingQty.get(bundleItem.SKU) || 0) - consumed;
          remainingQty.set(bundleItem.SKU, remaining);
        }

        const bundleDiscountPerSet = bundleGrossPerSet * 0.15;
        const bundleNetPerSet = bundleGrossPerSet - bundleDiscountPerSet;

        lines.push({
          sku: `BUNDLE:${bundle.BundleID}`,
          qty: maxBundleSets,
          unitPrice: bundleNetPerSet,
          tierDiscount: bundleDiscountPerSet * maxBundleSets,
          lineTotal: bundleNetPerSet * maxBundleSets,
          appliedMAP: false
        });

        subtotalGross += bundleGrossPerSet * maxBundleSets;
        tierDiscountTotal += bundleDiscountPerSet * maxBundleSets;
      }
    } catch (e) {
    }
  }

  for (const item of lineItems) {
    const leftoverQty = remainingQty.get(item.sku) || 0;
    if (leftoverQty === 0) continue;

    const { product } = item;
    const qty = leftoverQty;
    const landedCost = product.COGS_EUR || 0;
    const uvp = product.UVP || 0;
    const map = product.MAP || calculateMAP(uvp, landedCost, ctx);

    let unitPrice = uvp;
    let appliedMAP = false;

    if (tierDiscountPct > 0) {
      const discountedPrice = uvp * (1 - tierDiscountPct / 100);
      
      if (discountedPrice < map) {
        unitPrice = map;
        appliedMAP = true;
        mapViolations.push(`${product.SKU}: Tier discount would violate MAP (${map.toFixed(2)})`);
      } else {
        unitPrice = discountedPrice;
      }
    }

    const tierDiscount = (uvp - unitPrice) * qty;
    const lineTotal = unitPrice * qty;

    lines.push({
      sku: product.SKU,
      qty,
      unitPrice,
      tierDiscount,
      lineTotal,
      appliedMAP
    });

    subtotalGross += uvp * qty;
    tierDiscountTotal += tierDiscount;
  }

  const subtotalAfterTier = subtotalGross - tierDiscountTotal;

  const volumeDiscount = calculateVolumeDiscount(subtotalAfterTier, ctx.volumeLadder);
  const subscriptionDiscount = calculateSubscriptionDiscount(
    partner.PartnerID,
    subtotalAfterTier - volumeDiscount.discountAmt,
    ctx
  );

  const subtotalAfterDiscounts = 
    subtotalAfterTier - volumeDiscount.discountAmt - subscriptionDiscount.discountAmt;

  const loyaltyRedemption = calculateLoyaltyRedemption(
    loyaltyPointsToRedeem,
    loyaltyPointsAvailable,
    subtotalAfterDiscounts,
    ctx.loyaltyRedeemRate
  );

  const finalTotal = Math.max(0, subtotalAfterDiscounts - loyaltyRedemption.amountRedeemed);

  const marginGuardrails: string[] = [];
  const minMarginPct = ctx.params.get('MIN_MARGIN_PCT') || 10;

  if (subtotalAfterDiscounts > 0 && subtotalAfterTier > 0) {
    const totalDiscountsAmt = volumeDiscount.discountAmt + subscriptionDiscount.discountAmt + loyaltyRedemption.amountRedeemed;
    const lineProrationFactor = (subtotalAfterTier - totalDiscountsAmt) / subtotalAfterTier;

    for (const line of lines) {
      if (line.sku.startsWith('BUNDLE:')) {
        const bundleID = line.sku.replace('BUNDLE:', '');
        const bundle = ctx.bundles.get(bundleID);
        if (!bundle) continue;

        try {
          const bundleItems: { SKU: string; Qty: number }[] = JSON.parse(bundle.ItemsJSON);
          const effectiveBundlePrice = (line.lineTotal / line.qty) * lineProrationFactor;

          let bundleOriginalGross = 0;
          for (const bundleItem of bundleItems) {
            const lineItem = lineItems.find(li => li.sku === bundleItem.SKU);
            if (!lineItem) continue;
            const uvp = lineItem.product.UVP || 0;
            bundleOriginalGross += uvp * bundleItem.Qty;
          }

          for (const bundleItem of bundleItems) {
            const lineItem = lineItems.find(li => li.sku === bundleItem.SKU);
            if (!lineItem) continue;

            const product = lineItem.product;
            const landedCost = product.COGS_EUR || 0;
            const uvp = product.UVP || 0;
            const map = product.MAP ?? calculateMAP(uvp, landedCost, ctx);

            const componentShare = (uvp * bundleItem.Qty) / bundleOriginalGross;
            const effectiveComponentPrice = (effectiveBundlePrice * componentShare) / bundleItem.Qty;

            if (effectiveComponentPrice < map && map > 0) {
              mapViolations.push(
                `${product.SKU} (in ${line.sku}): Effective price (${effectiveComponentPrice.toFixed(2)}) violates MAP (${map.toFixed(2)})`
              );
            }

            if (effectiveComponentPrice < landedCost) {
              mapViolations.push(
                `${product.SKU} (in ${line.sku}): Effective price (${effectiveComponentPrice.toFixed(2)}) below landed cost (${landedCost.toFixed(2)}) - LOSS RISK`
              );
            }

            // Check margin floor on effective price
            if (effectiveComponentPrice > 0 && landedCost > 0) {
              const effectiveMargin = ((effectiveComponentPrice - landedCost) / effectiveComponentPrice) * 100;
              if (effectiveMargin < minMarginPct) {
                marginGuardrails.push(
                  `${product.SKU} (in ${line.sku}): Margin ${effectiveMargin.toFixed(1)}% below minimum ${minMarginPct}%`
                );
              }
            }
          }
        } catch (e) {
        }
        continue;
      }

      const product = lineItems.find(item => item.sku === line.sku)?.product;
      if (!product) continue;

      const landedCost = product.COGS_EUR || 0;
      const uvp = product.UVP || 0;
      const map = product.MAP ?? calculateMAP(uvp, landedCost, ctx);

      const effectiveUnitPrice = (line.lineTotal / line.qty) * lineProrationFactor;

      if (effectiveUnitPrice < map && map > 0) {
        mapViolations.push(
          `${line.sku}: Effective unit price (${effectiveUnitPrice.toFixed(2)}) after order discounts violates MAP (${map.toFixed(2)})`
        );
      }

      if (effectiveUnitPrice < landedCost) {
        mapViolations.push(
          `${line.sku}: Effective unit price (${effectiveUnitPrice.toFixed(2)}) below landed cost (${landedCost.toFixed(2)}) - LOSS RISK`
        );
      }

      // Check margin floor on effective price
      if (effectiveUnitPrice > 0 && landedCost > 0) {
        const effectiveMargin = ((effectiveUnitPrice - landedCost) / effectiveUnitPrice) * 100;
        if (effectiveMargin < minMarginPct) {
          marginGuardrails.push(
            `${line.sku}: Margin ${effectiveMargin.toFixed(1)}% below minimum ${minMarginPct}%`
          );
        }
      }
    }
  }

  const loyaltyEarned = calculateLoyaltyEarned(finalTotal, ctx.loyaltyEarnRate);

  const eligibleGifts = detectEligibleGifts(finalTotal, ctx.gifts);

  const commissions = calculateCommissions(
    finalTotal,
    partner.PartnerID,
    salesRep,
    affiliateID,
    ctx.commissionRules
  );

  // Calculate VAT
  const vatRate = ctx.params.get('VAT_Default_Pct') || 19;
  const vatAmount = (finalTotal * vatRate) / 100;
  const finalTotalWithVAT = finalTotal + vatAmount;

  return {
    lines,
    subtotalGross,
    tierDiscountTotal,
    volumeDiscountPct: volumeDiscount.discountPct,
    volumeDiscountAmt: volumeDiscount.discountAmt,
    subscriptionDiscountPct: subscriptionDiscount.discountPct,
    subscriptionDiscountAmt: subscriptionDiscount.discountAmt,
    subtotalAfterDiscounts,
    loyaltyRedeemed: loyaltyRedemption.amountRedeemed,
    finalTotal,
    vatRate,
    vatAmount,
    finalTotalWithVAT,
    loyaltyEarned,
    eligibleGifts,
    commissions,
    mapViolations,
    marginGuardrails
  };
}
