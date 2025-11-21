/**
 * Bundling Module for Pricing Engine V2.2
 * 
 * Automatically calculates optimal bundle configurations to meet
 * Amazon FBA/FBM guardrails while maintaining competitive pricing.
 * 
 * Business Logic:
 * - Tries N units (2-6) and finds minimum N that meets guardrails
 * - Distributes fixed costs (FBA fees, box costs) across N units
 * - Uses price ladder for .99 rounding
 * - Calculates Grundpreis for bundles (total volume / total price)
 * - Prioritizes FBA > FBM > OwnStore coverage
 */

import { getPricingEngine } from './pricing-engine-v2';
import type { ProductInput, ProductPricingResult, PricingConfig } from './pricing-engine-v2';

const engine = getPricingEngine();
const config = engine.getConfig();

// V2.2 Bundling config
interface BundlingConfig {
  autotuneRaiseCap: number;
  minUnits: number;
  maxUnits: number;
  preferEvenUnits: boolean;
  priceLadderInc: number[];
  channelsConsidered: string[];
  minGpMlFlag: boolean;
}

const bundlingConfig: BundlingConfig = (config as any).bundling || {
  autotuneRaiseCap: 0.25,
  minUnits: 2,
  maxUnits: 6,
  preferEvenUnits: true,
  priceLadderInc: [14.99, 16.99, 18.99, 19.99, 21.99, 23.99, 24.99, 26.99, 27.99, 29.99, 32.99],
  channelsConsidered: ['Amazon_FBA', 'Amazon_FBM', 'OwnStore'],
  minGpMlFlag: true,
};

export interface BundleProposal {
  baseEAN: string;
  baseSKU: string;
  units: number;
  proposedUvpInc99: number;
  
  // Guardrails
  minIncOwn?: number;
  minIncFBM?: number;
  minIncFBA?: number;
  
  // Coverage flags
  okOwn: boolean;
  okFBM: boolean;
  okFBA: boolean;
  allChannelsOK: boolean;
  
  // Grundpreis
  totalNetContentMl?: number;
  grundpreisIncPerL?: number;
  
  // Cost breakdown
  fullCostUnit: number;
  fullCostBundle: number;
  boxCostPerUnit: number;
  boxCostBundle: number;
  
  // Margin analysis
  marginAtProposedPrice: number;
  
  // Original product info
  singleUnitUVP: number;
  singleUnitGuardrails: {
    OwnStore: number;
    Amazon_FBM: number;
    Amazon_FBA: number;
  };
}

/**
 * Calculate bundle proposals for a single product
 * 
 * @param product - Product input data
 * @param baseEAN - Optional EAN/barcode for the base product
 * @returns Array of bundle proposals, sorted by coverage (best first)
 */
export function recommendBundlesForSKU(
  product: ProductInput,
  baseEAN?: string
): BundleProposal[] {
  const proposals: BundleProposal[] = [];
  
  // 1) Calculate single unit pricing first
  const singleResult = engine.calculateProductPricing(product);
  
  // If single unit already meets all guardrails, no bundling needed
  const singleOK = 
    singleResult.uvpInc99 >= singleResult.guardrails.OwnStore &&
    singleResult.uvpInc99 >= singleResult.guardrails.Amazon_FBM &&
    singleResult.uvpInc99 >= singleResult.guardrails.Amazon_FBA;
  
  if (singleOK) {
    // Return empty proposals - product is OK as single unit
    return [];
  }
  
  // 2) Try different bundle sizes
  const minN = bundlingConfig.minUnits;
  const maxN = bundlingConfig.maxUnits;
  
  for (let N = minN; N <= maxN; N++) {
    // Skip odd numbers if preferEvenUnits is true (except if it's the last option)
    if (bundlingConfig.preferEvenUnits && N % 2 === 1 && N < maxN) {
      continue;
    }
    
    // Create bundle product by scaling costs
    const bundleProduct: ProductInput = {
      ...product,
      sku: `${product.sku}-BUNDLE-${N}`,
      factoryUnitManual: (product.factoryUnitManual || 0) * N,
      shippingInboundPerUnit: product.shippingInboundPerUnit * N,
      eprLucid: product.eprLucid * N,
      gs1: product.gs1 * N,
      retailPackaging: product.retailPackaging * N,
      qcPif: product.qcPif * N,
      operations: product.operations * N,
      marketing: product.marketing * N,
      // Gift costs typically don't scale for bundles (one gift per bundle)
      giftSkuCost: 0,
      giftAttachRate: 0,
      // Box size might need to upgrade for larger bundles
      boxSize: N <= 2 ? 'Small' : N <= 4 ? 'Medium' : 'Large',
      // Amazon tier might change for larger bundles (heavier/bigger)
      amazonTierKey: N <= 2 ? 'Std_Parcel_S' : N <= 4 ? 'Std_Parcel_M' : 'Std_Parcel_L',
    };
    
    // Calculate bundle pricing
    const bundleResult = engine.calculateProductPricing(bundleProduct);
    
    // Find minimum guardrail needed across channels
    const maxGuardrail = Math.max(
      bundleResult.guardrails.OwnStore || 0,
      bundleResult.guardrails.Amazon_FBM || 0,
      bundleResult.guardrails.Amazon_FBA || 0
    );
    
    // Find proposed price from ladder that meets guardrails
    const ladder = bundlingConfig.priceLadderInc;
    const proposedPrice = ladder.find(p => p >= maxGuardrail) || Math.ceil(maxGuardrail);
    
    // Check coverage for each channel
    const okOwn = proposedPrice >= (bundleResult.guardrails.OwnStore || 0);
    const okFBM = proposedPrice >= (bundleResult.guardrails.Amazon_FBM || 0);
    const okFBA = proposedPrice >= (bundleResult.guardrails.Amazon_FBA || 0);
    const allChannelsOK = okOwn && okFBM && okFBA;
    
    // Calculate Grundpreis for bundle
    const totalMl = (product.netContentMl || 0) * N;
    const grundpreis = totalMl > 0 ? (proposedPrice / (totalMl / 1000)) : undefined;
    
    // Calculate margin at proposed price
    const costBundle = bundleResult.fullCostUnit + bundleResult.boxCostPerUnit + bundleResult.giftCostExpectedUnit;
    const marginAtProposed = costBundle > 0 ? ((proposedPrice / 1.19 - costBundle) / costBundle) : 0;
    
    const proposal: BundleProposal = {
      baseEAN: baseEAN || product.sku,
      baseSKU: product.sku,
      units: N,
      proposedUvpInc99: proposedPrice,
      
      minIncOwn: bundleResult.guardrails.OwnStore,
      minIncFBM: bundleResult.guardrails.Amazon_FBM,
      minIncFBA: bundleResult.guardrails.Amazon_FBA,
      
      okOwn,
      okFBM,
      okFBA,
      allChannelsOK,
      
      totalNetContentMl: totalMl,
      grundpreisIncPerL: grundpreis,
      
      fullCostUnit: bundleResult.fullCostUnit / N,
      fullCostBundle: bundleResult.fullCostUnit,
      boxCostPerUnit: bundleResult.boxCostPerUnit / N,
      boxCostBundle: bundleResult.boxCostPerUnit,
      
      marginAtProposedPrice: marginAtProposed * 100,
      
      singleUnitUVP: singleResult.uvpInc99,
      singleUnitGuardrails: singleResult.guardrails,
    };
    
    proposals.push(proposal);
    
    // Early exit if we found a solution that works for all channels
    if (allChannelsOK) {
      break;
    }
  }
  
  // Sort proposals by coverage quality
  proposals.sort((a, b) => {
    // First: prefer solutions that cover all channels
    if (a.allChannelsOK !== b.allChannelsOK) {
      return a.allChannelsOK ? -1 : 1;
    }
    
    // Second: prefer more channels covered
    const scoreA = (+a.okOwn) + (+a.okFBM) + (+a.okFBA);
    const scoreB = (+b.okOwn) + (+b.okFBM) + (+b.okFBA);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    
    // Third: prefer lower price (better for customers)
    if (a.proposedUvpInc99 !== b.proposedUvpInc99) {
      return a.proposedUvpInc99 - b.proposedUvpInc99;
    }
    
    // Fourth: prefer fewer units (simpler bundle)
    return a.units - b.units;
  });
  
  return proposals;
}

/**
 * Generate bundling report for all products
 * 
 * @param products - Array of products to analyze
 * @returns Summary with bundling recommendations
 */
export function generateBundlingReport(products: ProductInput[]): {
  total: number;
  needsBundling: number;
  alreadyOK: number;
  proposals: Array<{
    sku: string;
    line: string;
    singleUVP: number;
    recommendation: BundleProposal | null;
  }>;
} {
  const report = {
    total: products.length,
    needsBundling: 0,
    alreadyOK: 0,
    proposals: [] as Array<{
      sku: string;
      line: string;
      singleUVP: number;
      recommendation: BundleProposal | null;
    }>,
  };
  
  for (const product of products) {
    const proposals = recommendBundlesForSKU(product);
    
    if (proposals.length === 0) {
      // Product is OK as single unit
      report.alreadyOK++;
      const single = engine.calculateProductPricing(product);
      report.proposals.push({
        sku: product.sku,
        line: product.line,
        singleUVP: single.uvpInc99,
        recommendation: null,
      });
    } else {
      // Product needs bundling
      report.needsBundling++;
      const single = engine.calculateProductPricing(product);
      report.proposals.push({
        sku: product.sku,
        line: product.line,
        singleUVP: single.uvpInc99,
        recommendation: proposals[0], // Best proposal
      });
    }
  }
  
  return report;
}
