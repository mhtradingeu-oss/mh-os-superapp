import prisma from "@src/core/prisma.js";

export type ChannelKey =
  | "B2C"
  | "AMAZON"
  | "DEALER_BASIC"
  | "DEALER_PLUS"
  | "STAND_PARTNER"
  | "DISTRIBUTOR";

export type ChannelHeatmapCell = {
  channel: ChannelKey;
  netPrice: number | null;
  grossPrice: number | null;
  marginPct: number | null;
  costPerUnit: number | null;
  profitability: "LOSS" | "LOW" | "HEALTHY" | "PREMIUM" | "UNKNOWN";
};

export type ProductHeatmapResult = {
  productId: string;
  productName: string;
  sku: string | null;
  line: string | null;
  status: string | null;
  channels: ChannelHeatmapCell[];
  summary: {
    healthy: ChannelKey[];
    risky: ChannelKey[];
    unknown: ChannelKey[];
  };
};

function calcMargin(net: number | null, cost: number | null): number | null {
  if (net == null || cost == null) return null;
  if (net === 0) return null;
  return ((net - cost) / net) * 100;
}

function classifyMargin(
  margin: number | null
): ChannelHeatmapCell["profitability"] {
  if (margin == null) return "UNKNOWN";
  if (margin < 0) return "LOSS";
  if (margin < 25) return "LOW";
  if (margin <= 50) return "HEALTHY";
  return "PREMIUM";
}

export async function getProductHeatmap(
  productId: string
): Promise<ProductHeatmapResult | null> {
  const product = await prisma.brandProduct.findUnique({
    where: { id: productId },
    include: {
      pricing: true, // علاقة 1:1 مع ProductPricing
    },
  });

  if (!product) return null;

  const pricing = product.pricing;

  // نحاول نستخدم fullCostEur أولاً، ولو مش موجود نرجع لـ cogsEur
  const cost =
    pricing?.fullCostEur ??
    pricing?.cogsEur ??
    null;

  const channels: ChannelHeatmapCell[] = [];

  const pushChannel = (
    channel: ChannelKey,
    net: number | null | undefined,
    gross: number | null | undefined
  ) => {
    const m = calcMargin(net ?? null, cost);
    channels.push({
      channel,
      netPrice: net ?? null,
      grossPrice: gross ?? null,
      marginPct: m,
      costPerUnit: cost,
      profitability: classifyMargin(m),
    });
  };

  // B2C Store
  pushChannel(
    "B2C",
    pricing?.b2cStoreNet ?? null,
    pricing?.b2cStoreInc ?? null
  );

  // Amazon
  pushChannel(
    "AMAZON",
    pricing?.amazonNet ?? null,
    pricing?.amazonInc ?? null
  );

  // Dealer Basic / Plus
  pushChannel("DEALER_BASIC", pricing?.dealerBasicNet ?? null, null);
  pushChannel("DEALER_PLUS", pricing?.dealerPlusNet ?? null, null);

  // Stand Partner
  pushChannel("STAND_PARTNER", pricing?.standPartnerNet ?? null, null);

  // Distributor
  pushChannel("DISTRIBUTOR", pricing?.distributorNet ?? null, null);

  const summary = {
    healthy: channels
      .filter(
        (c) =>
          c.profitability === "HEALTHY" ||
          c.profitability === "PREMIUM"
      )
      .map((c) => c.channel),
    risky: channels
      .filter(
        (c) =>
          c.profitability === "LOSS" ||
          c.profitability === "LOW"
      )
      .map((c) => c.channel),
    unknown: channels
      .filter((c) => c.profitability === "UNKNOWN")
      .map((c) => c.channel),
  };

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku ?? null,
    line: product.line ?? null,
    status: product.status ?? null,
    channels,
    summary,
  };
}
