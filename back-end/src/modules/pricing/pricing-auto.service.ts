
import {
  getProductPricingBySku,
  getProductPricingById,
  type ChannelKey,
} from "./pricing.service.js";

type NullableNumber = number | null;

type AutoMatrixInput = {
  sku?: string;
  productId?: string;
};

type ChannelTargetBand = {
  minMargin: number; // كـ نسبة مئوية
  maxMargin: number;
};

const CHANNEL_TARGETS: Record<ChannelKey, ChannelTargetBand> = {
  B2C: { minMargin: 35, maxMargin: 45 },
  AMAZON: { minMargin: 30, maxMargin: 38 },
  DEALER_BASIC: { minMargin: 22, maxMargin: 28 },
  DEALER_PLUS: { minMargin: 20, maxMargin: 26 },
  STAND: { minMargin: 18, maxMargin: 24 },
  DISTRIBUTOR: { minMargin: 15, maxMargin: 22 },
};

const ALL_CHANNELS: ChannelKey[] = [
  "B2C",
  "AMAZON",
  "DEALER_BASIC",
  "DEALER_PLUS",
  "STAND",
  "DISTRIBUTOR",
];

function calcGross(net: NullableNumber, vatPct: NullableNumber) {
  if (net == null) return { gross: null, vatAmount: null };
  const vat = vatPct ?? 19;
  const gross = net * (1 + vat / 100);
  const vatAmount = gross - net;
  return { gross, vatAmount };
}

function computeRecommendedNet(
  channel: ChannelKey,
  baseCost: NullableNumber,
  currentNet: NullableNumber,
  currentMargin: NullableNumber
): { recommendedNet: NullableNumber; notes: string[] } {
  const notes: string[] = [];
  if (baseCost == null || currentNet == null || currentMargin == null) {
    notes.push("Insufficient data to compute recommended price.");
    return { recommendedNet: null, notes };
  }

  const band = CHANNEL_TARGETS[channel];
  if (!band) {
    notes.push("No target margin band defined for this channel.");
    return { recommendedNet: currentNet, notes };
  }

  const { minMargin, maxMargin } = band;
  const midMargin = (minMargin + maxMargin) / 2;

  let recommendedNet: NullableNumber = currentNet;

  // 1) Margin أقل من المطلوب → نرفع السعر
  if (currentMargin < minMargin) {
    const m = midMargin / 100;
    const candidate = baseCost / (1 - m);
    recommendedNet = candidate;
    notes.push(
      `Margin (${currentMargin.toFixed(
        1
      )}%) below target band [${minMargin}–${maxMargin}]%. Recommending price increase.`
    );
  }
  // 2) Margin داخل الباند → نتركها كما هي
  else if (currentMargin >= minMargin && currentMargin <= maxMargin) {
    recommendedNet = currentNet;
    notes.push(
      `Margin (${currentMargin.toFixed(
        1
      )}%) within optimal band [${minMargin}–${maxMargin}]%.`
    );
  }
  // 3) Margin أعلى من الباند → ننصح بالتخفيض
  else if (currentMargin > maxMargin) {
    const lowerBoundNet = baseCost / (1 - minMargin / 100);
    const slightlyReduced = currentNet * 0.95; // تخفيض بسيط 5%

    // نختار الأكبر بين الحد الأدنى المقبول وسعر مخفّض قليلاً
    recommendedNet = Math.max(lowerBoundNet, slightlyReduced);
    notes.push(
      `Margin (${currentMargin.toFixed(
        1
      )}%) above optimal band [${minMargin}–${maxMargin}]%. Recommending slight price decrease.`
    );
  }

  return { recommendedNet, notes };
}

export async function generatePricingMatrix(input: AutoMatrixInput) {
  const { sku, productId } = input;

  if (!sku && !productId) {
    throw new Error("Either sku or productId is required");
  }

  // نستخدم نفس الـ service اللي بنيناها من قبل
  const pricingData = sku
    ? await getProductPricingBySku(sku)
    : await getProductPricingById(productId!);

  if (!pricingData) return null;

  const baseCostValue: NullableNumber = pricingData.baseCost?.value ?? null;
  const matrix: any[] = [];

  for (const channel of ALL_CHANNELS) {
    const ch = pricingData.channels[channel];
    if (!ch) {
      matrix.push({
        channel,
        current: null,
        recommended: null,
        notes: [`No pricing data for channel ${channel}.`],
      });
      continue;
    }

    const currentNet: NullableNumber = ch.net ?? null;
    const currentGross: NullableNumber = ch.gross ?? null;
    const currentMargin: NullableNumber = ch.marginPct ?? null;
    const vatPct: NullableNumber = ch.vatPct ?? 19;

    if (currentNet == null || baseCostValue == null) {
      matrix.push({
        channel,
        current: {
          net: currentNet,
          gross: currentGross,
          marginPct: currentMargin,
        },
        recommended: null,
        notes: [
          "Missing cost or price data. Cannot compute recommended price.",
        ],
      });
      continue;
    }

    const { recommendedNet, notes } = computeRecommendedNet(
      channel,
      baseCostValue,
      currentNet,
      currentMargin
    );

    let recoGross: NullableNumber = null;
    let recoMarginPct: NullableNumber = null;
    let changePct: NullableNumber = null;

    if (recommendedNet != null) {
      const g = calcGross(recommendedNet, vatPct);
      recoGross = g.gross;

      // marginPct = (net - cost)/net * 100
      if (baseCostValue != null) {
        recoMarginPct = ((recommendedNet - baseCostValue) / recommendedNet) * 100;
      }

      changePct = ((recommendedNet - currentNet) / currentNet) * 100;
    }

    matrix.push({
      channel,
      current: {
        net: currentNet,
        gross: currentGross,
        marginPct: currentMargin,
      },
      recommended: {
        net: recommendedNet,
        gross: recoGross,
        marginPct: recoMarginPct,
        changePct,
      },
      notes,
    });
  }

  return {
    product: pricingData.product,
    baseCost: pricingData.baseCost,
    brandPricingConfig: pricingData.brandPricingConfig,
    matrix,
  };
}
export type PricingSimulation = {
  product: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
  base: {
    net: number | null;
    gross: number | null;
    marginPct: number | null;
  };
  baseCost: {
    value: number | null;
  };
  channelsComparison?: Record<string, any>;
  matrix?: Array<{
    channel: string;
    current: {
      net: number | null;
      gross: number | null;
      marginPct: number | null;
    } | null;
    recommended: {
      net: number | null;
      gross: number | null;
      marginPct: number | null;
      changePct: number | null;
    } | null;
    notes: string[];
  }>;
};

