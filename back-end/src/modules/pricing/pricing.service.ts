import prisma from "@src/core/prisma.js";

export type ChannelKey =
  | "B2C"
  | "AMAZON"
  | "DEALER_BASIC"
  | "DEALER_PLUS"
  | "STAND"
  | "DISTRIBUTOR";

type NullableNumber = number | null;

function n(v: unknown): NullableNumber {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function calcMargin(net: NullableNumber, cost: NullableNumber) {
  if (net == null || cost == null) return { marginAbs: null, marginPct: null };
  const marginAbs = net - cost;
  const marginPct = net === 0 ? 0 : (marginAbs / net) * 100;
  return { marginAbs, marginPct };
}

function calcGross(net: NullableNumber, vatPct: NullableNumber) {
  if (net == null) return { gross: null, vatAmount: null };
  const vat = vatPct ?? 0;
  const gross = net * (1 + vat / 100);
  const vatAmount = gross - net;
  return { gross, vatAmount };
}

// ─────────────────────────────────────────────
//  PUBLIC: Get pricing by productId / SKU
// ─────────────────────────────────────────────

export async function getProductPricingById(productId: string) {
  const product = await prisma.brandProduct.findUnique({
    where: { id: productId },
    include: {
      brand: {
        include: {
          pricing: true,
        },
      },
      pricing: true,
      category: true,
    },
  });

  if (!product) return null;

  return buildPricingResponse(product);
}

export async function getProductPricingBySku(sku: string) {
  const product = await prisma.brandProduct.findUnique({
    where: { sku },
    include: {
      brand: {
        include: {
          pricing: true,
        },
      },
      pricing: true,
      category: true,
    },
  });

  if (!product) return null;

  return buildPricingResponse(product);
}

// ─────────────────────────────────────────────
//  CORE: Build pricing response
// ─────────────────────────────────────────────

function buildPricingResponse(product: any) {
  const p = product.pricing ?? {};
  const bp = product.brand?.pricing ?? {};

  // Cost components per unit
  const components = {
    factoryPriceUnit: n(p.factoryPriceUnit),
    eprLucidPerUnit: n(p.eprLucidPerUnit),
    shippingInboundPerUnit: n(p.shippingInboundPerUnit),
    gs1PerUnit: n(p.gs1PerUnit),
    retailPackagingPerUnit: n(p.retailPackagingPerUnit),
    qcPifPerUnit: n(p.qcPifPerUnit),
    operationsPerUnit: n(p.operationsPerUnit),
    marketingPerUnit: n(p.marketingPerUnit),
  };

  const componentSum =
    (components.factoryPriceUnit ?? 0) +
    (components.eprLucidPerUnit ?? 0) +
    (components.shippingInboundPerUnit ?? 0) +
    (components.gs1PerUnit ?? 0) +
    (components.retailPackagingPerUnit ?? 0) +
    (components.qcPifPerUnit ?? 0) +
    (components.operationsPerUnit ?? 0) +
    (components.marketingPerUnit ?? 0);

  const cogsEur = n(p.cogsEur);
  const fullCostEur = n(p.fullCostEur);

  const baseCost =
    fullCostEur ??
    cogsEur ??
    (componentSum > 0 ? componentSum : null);

  const vatPct = n(p.vatPct) ?? 19;

  const channels: Record<ChannelKey, any> = {
    B2C: buildChannelPrice(
      {
        net: n(p.b2cStoreNet ?? p.uvpNet),
        inc: n(p.b2cStoreInc ?? p.uvpInc),
      },
      baseCost,
      vatPct
    ),
    AMAZON: buildChannelPrice(
      {
        net: n(p.amazonNet),
        inc: n(p.amazonInc),
      },
      baseCost,
      vatPct,
      p.amazonTierKey
    ),
    DEALER_BASIC: buildChannelPrice(
      {
        net: n(p.dealerBasicNet),
      },
      baseCost,
      vatPct
    ),
    DEALER_PLUS: buildChannelPrice(
      {
        net: n(p.dealerPlusNet),
      },
      baseCost,
      vatPct
    ),
    STAND: buildChannelPrice(
      {
        net: n(p.standPartnerNet),
      },
      baseCost,
      vatPct
    ),
    DISTRIBUTOR: buildChannelPrice(
      {
        net: n(p.distributorNet),
      },
      baseCost,
      vatPct
    ),
  };

  return {
    product: {
      id: product.id,
      sku: product.sku,
      upc: product.upc,
      name: product.name,
      line: product.line,
      status: product.status,
      brand: {
        id: product.brand?.id,
        name: product.brand?.name,
        slug: product.brand?.slug,
      },
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : null,
    },
    baseCost: {
      currency: "EUR",
      value: baseCost,
      cogsEur,
      fullCostEur,
      components,
    },
    brandPricingConfig: bp
      ? {
          costMultiplier: n(bp.costMultiplier),
          wholesaleMultiplier: n(bp.wholesaleMultiplier),
          retailMultiplier: n(bp.retailMultiplier),
          standDiscount: n(bp.standDiscount),
          onlineDiscount: n(bp.onlineDiscount),
          dealerDiscount: n(bp.dealerDiscount),
          loyaltyEarnRate: n(bp.loyaltyEarnRate),
          loyaltyRedeemRate: n(bp.loyaltyRedeemRate),
          aiDynamicPricing: bp.aiDynamicPricing ?? false,
          aiMarketFactor: n(bp.aiMarketFactor),
          aiCompetitionFactor: n(bp.aiCompetitionFactor),
        }
      : null,
    channels,
  };
}

function buildChannelPrice(
  src: { net?: NullableNumber; inc?: NullableNumber },
  baseCost: NullableNumber,
  vatPct: NullableNumber,
  extra?: any
) {
  let net = src.net ?? null;
  let inc = src.inc ?? null;

  if (net == null && inc != null) {
    net = vatPct != null ? inc / (1 + vatPct / 100) : inc;
  }

  if (inc == null && net != null) {
    const g = calcGross(net, vatPct);
    inc = g.gross;
  }

  const { marginAbs, marginPct } = calcMargin(net, baseCost);
  const { gross, vatAmount } = calcGross(net, vatPct);

  return {
    net,
    gross,
    vatPct,
    vatAmount,
    marginAbs,
    marginPct,
    extra,
  };
}

// ─────────────────────────────────────────────
//  V2: Pricing Simulation
// ─────────────────────────────────────────────

export type PricingSimulationParams = {
  sku?: string;
  productId?: string;
  channel: ChannelKey;
  discountPct?: number;      // تخفيض كنسبة % من السعر الحالي
  overrideNet?: number;      // سعر Net مخصص
  targetMarginPct?: number;  // هامش مستهدف
};

export async function simulatePricingScenario(params: PricingSimulationParams) {
  const { sku, productId, channel, discountPct, overrideNet, targetMarginPct } =
    params;

  if (!sku && !productId) {
    throw new Error("Either sku or productId is required");
  }

  // Load product with same shape used in buildPricingResponse
  const product = await prisma.brandProduct.findFirst({
    where: sku ? { sku } : { id: productId! },
    include: {
      brand: {
        include: {
          pricing: true,
        },
      },
      pricing: true,
      category: true,
    },
  });

  if (!product) return null;

  const pricingData = buildPricingResponse(product);

  const baseCost = pricingData.baseCost.value;
  const vatPct = pricingData.channels[channel]?.vatPct ?? 19;

  const baseChannel = pricingData.channels[channel];

  if (!baseChannel) {
    throw new Error(`Channel ${channel} not available for this product`);
  }

  const baseNet: NullableNumber = baseChannel.net;

  // إذا ما في سعر أساس للقناة → ما نقدر نحسب
  if (baseNet == null && !overrideNet && !targetMarginPct) {
    return {
      ...pricingData,
      simulation: {
        channel,
        reason: "No base price available and no override/target provided.",
      },
    };
  }

  let scenarioNet: NullableNumber = baseNet;

  // 1️⃣ Highest priority: overrideNet
  if (typeof overrideNet === "number" && !Number.isNaN(overrideNet)) {
    scenarioNet = overrideNet;
  }
  // 2️⃣ Second: discountPct on baseNet
  else if (
    typeof discountPct === "number" &&
    baseNet != null &&
    !Number.isNaN(discountPct)
  ) {
    scenarioNet = baseNet * (1 - discountPct / 100);
  }
  // 3️⃣ Third: targetMarginPct based on baseCost
  else if (
    typeof targetMarginPct === "number" &&
    baseCost != null &&
    !Number.isNaN(targetMarginPct)
  ) {
    // marginPct = (net - cost) / net → net = cost / (1 - marginPct/100)
    const m = targetMarginPct / 100;
    scenarioNet = m >= 1 ? null : baseCost / (1 - m);
  }

  const baseMargin = calcMargin(baseNet, baseCost);
  const baseGross = baseNet != null ? calcGross(baseNet, vatPct) : { gross: null, vatAmount: null };

  const scenarioMargin = calcMargin(scenarioNet, baseCost);
  const scenarioGross =
    scenarioNet != null ? calcGross(scenarioNet, vatPct) : { gross: null, vatAmount: null };

  return {
    product: pricingData.product,
    baseCost: pricingData.baseCost,
    brandPricingConfig: pricingData.brandPricingConfig,
    channel,
    base: {
      net: baseNet,
      gross: baseGross.gross,
      vatPct,
      vatAmount: baseGross.vatAmount,
      marginAbs: baseMargin.marginAbs,
      marginPct: baseMargin.marginPct,
    },
    scenario: {
      net: scenarioNet,
      gross: scenarioGross.gross,
      vatPct,
      vatAmount: scenarioGross.vatAmount,
      marginAbs: scenarioMargin.marginAbs,
      marginPct: scenarioMargin.marginPct,
      discountPct: discountPct ?? null,
      overrideNet: overrideNet ?? null,
      targetMarginPct: targetMarginPct ?? null,
    },
  };
}
