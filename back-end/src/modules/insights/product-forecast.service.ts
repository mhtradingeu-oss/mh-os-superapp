import prisma from "@src/core/prisma.js";
import type { ChannelKey } from "./product-heatmap.service.js";

export type ForecastScenarioResult = {
  channel: ChannelKey;
  baseNet: number | null;
  baseMarginPct: number | null;
  newNet: number | null;
  newMarginPct: number | null;
  priceChangePct: number;
  estimatedDemandChangePct: number | null;
  profitabilityImpactPct: number | null;
};

export type ProductForecastResult = {
  productId: string;
  productName: string;
  sku: string | null;
  scenarioPct: number;
  channel?: ChannelKey;
  results: ForecastScenarioResult[];
};

function calcMargin(net: number | null, cost: number | null): number | null {
  if (net == null || cost == null || net === 0) return null;
  return ((net - cost) / net) * 100;
}

export async function forecastProductPricing(params: {
  productId: string;
  scenarioPct: number; // +5, -3, ...
  channel?: ChannelKey;
}): Promise<ProductForecastResult | null> {
  const { productId, scenarioPct, channel } = params;

  const product = await prisma.brandProduct.findUnique({
    where: { id: productId },
    include: { pricing: true },
  });

  if (!product) return null;

  const pricing = product.pricing;
  const cost =
    pricing?.fullCostEur ??
    pricing?.cogsEur ??
    null;

  const allChannels: { key: ChannelKey; net?: number | null }[] = [
    { key: "B2C", net: pricing?.b2cStoreNet },
    { key: "AMAZON", net: pricing?.amazonNet },
    { key: "DEALER_BASIC", net: pricing?.dealerBasicNet },
    { key: "DEALER_PLUS", net: pricing?.dealerPlusNet },
    { key: "STAND_PARTNER", net: pricing?.standPartnerNet },
    { key: "DISTRIBUTOR", net: pricing?.distributorNet },
  ];

  const activeChannels = allChannels.filter(
    (c) => c.net != null && (!channel || c.key === channel)
  );

  const results: ForecastScenarioResult[] = activeChannels.map((c) => {
    const baseNet = c.net ?? null;
    const baseMarginPct = calcMargin(baseNet, cost);

    const newNet =
      baseNet != null ? baseNet * (1 + scenarioPct / 100) : null;
    const newMarginPct = calcMargin(newNet, cost);

    // نموذج مرونة بسيط: كل +10% سعر → -5% طلب (و العكس)
    const estimatedDemandChangePct =
      scenarioPct === 0 ? 0 : -0.5 * scenarioPct;

    let profitabilityImpactPct: number | null = null;
    if (baseNet != null && cost != null && newNet != null) {
      const baseProfit = baseNet - cost;
      const newProfit = newNet - cost;
      if (baseProfit !== 0) {
        profitabilityImpactPct =
          ((newProfit - baseProfit) / baseProfit) * 100;
      }
    }

    return {
      channel: c.key,
      baseNet,
      baseMarginPct,
      newNet,
      newMarginPct,
      priceChangePct: scenarioPct,
      estimatedDemandChangePct,
      profitabilityImpactPct,
    };
  });

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku ?? null,
    scenarioPct,
    channel,
    results,
  };
}
