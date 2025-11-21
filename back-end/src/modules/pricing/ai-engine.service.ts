import { simulatePricingScenario } from "./pricing.service.js";

export type AIPricingMode = "SAFE" | "BALANCED" | "AGGRESSIVE";

export type AIPricingEngineInput = {
  sku?: string;
  productId?: string;
  channel: string;
  mode?: AIPricingMode;
};

export type AIPricingScoreBlock = {
  marginScore: number;      // -100 .. +100
  costScore: number;        // -100 .. +100
  competitorScore: number;  // -100 .. +100
  stockScore: number;       // -100 .. +100
  globalScore: number;      // 0 .. 100
};

export type AIPricingFlags = {
  lowMargin: boolean;
  veryLowMargin: boolean;
  highMargin: boolean;
  veryHighMargin: boolean;

  highCostRatio: boolean;
  veryHighCostRatio: boolean;
  veryEfficientCost: boolean;

  underpricedVsMarket: boolean;
  overpricedVsMarket: boolean;

  lowStockRisk: boolean;
  overStockRisk: boolean;
};

export type AIPricingRecommendation = {
  action: "INCREASE" | "DECREASE" | "KEEP";
  suggestedChangePct: number;   // +10 => increase 10%, -5 => decrease 5%
  minChangePct: number;
  maxChangePct: number;
  targetMarginPct?: number | null;
  targetNetPrice?: number | null;
  confidence: number;           // 0..1
  rationale: string[];
};

export type AIPricingEngineResult = {
  product: any;
  channel: string;
  mode: AIPricingMode;
  base: any;
  cost: any;
  competitorStats?: {
    min?: number;
    max?: number;
    avg?: number;
    diffAbs?: number;
    diffPct?: number;
    position?: "BELOW" | "ABOVE" | "IN_RANGE";
  } | null;
  stock?: any;
  scores: AIPricingScoreBlock;
  flags: AIPricingFlags;
  recommendation: AIPricingRecommendation;
  debug: {
    rawSimulation: any;
  };
};

/**
 * V9 AI Pricing Engine – Core Brain
 */
export async function runAIPricingEngine(
  params: AIPricingEngineInput
): Promise<AIPricingEngineResult | null> {
  const { sku, productId } = params;
  const channel = params.channel.toUpperCase();
  const mode: AIPricingMode = (params.mode ?? "BALANCED").toUpperCase() as AIPricingMode;

  // نستخدم أي نتيجة موجودة من simulatePricingScenario
  const sim: any = await simulatePricingScenario({
    sku,
    productId,
    channel,
  });

  if (!sim) return null;

  const base = sim.base ?? {};
  const baseNet: number | null = typeof base.net === "number" ? base.net : null;
  const margin: number | null =
    typeof base.marginPct === "number" ? base.marginPct : null;
  const costValue: number | null =
    typeof sim?.baseCost?.value === "number" ? sim.baseCost.value : null;

  const competitorAI: any = sim.competitorAI ?? null;
  const compStats = competitorAI?.competitorStats ?? null;

  const stock: any = sim.stock ?? null;

  // =========================
  // 1) تحليل المارجن
  // =========================
  let marginScore = 0;
  const flags: AIPricingFlags = {
    lowMargin: false,
    veryLowMargin: false,
    highMargin: false,
    veryHighMargin: false,

    highCostRatio: false,
    veryHighCostRatio: false,
    veryEfficientCost: false,

    underpricedVsMarket: false,
    overpricedVsMarket: false,

    lowStockRisk: false,
    overStockRisk: false,
  };

  const rationale: string[] = [];

  if (margin !== null) {
    if (margin < 15) {
      flags.veryLowMargin = true;
      flags.lowMargin = true;
      marginScore -= 60;
      rationale.push(`❗ Margin extremely low (${margin.toFixed(1)}%).`);
    } else if (margin < 25) {
      flags.lowMargin = true;
      marginScore -= 30;
      rationale.push(`⚠️ Margin below target (${margin.toFixed(1)}%).`);
    } else if (margin >= 25 && margin <= 45) {
      marginScore += 40;
      rationale.push(`✅ Healthy margin (${margin.toFixed(1)}%).`);
    } else if (margin > 45 && margin <= 60) {
      flags.highMargin = true;
      marginScore += 10;
      rationale.push(`ℹ️ High margin (${margin.toFixed(1)}%). Monitor competitiveness.`);
    } else if (margin > 60) {
      flags.veryHighMargin = true;
      flags.highMargin = true;
      marginScore -= 20;
      rationale.push(`⚠️ Very high margin (${margin.toFixed(1)}%) – risk of overpricing.`);
    }
  }

  // =========================
  // 2) تحليل تكلفة / سعر
  // =========================
  let costScore = 0;
  let costRatio: number | null = null;

  if (baseNet !== null && costValue !== null && baseNet > 0) {
    costRatio = costValue / baseNet;

    if (costRatio > 0.8) {
      flags.veryHighCostRatio = true;
      flags.highCostRatio = true;
      costScore -= 60;
      rationale.push(
        `❗ Cost ratio very high (${(costRatio * 100).toFixed(
          1
        )}%). Price barely covers cost.`
      );
    } else if (costRatio > 0.65) {
      flags.highCostRatio = true;
      costScore -= 30;
      rationale.push(
        `⚠️ Cost ratio above normal (${(costRatio * 100).toFixed(1)}%).`
      );
    } else if (costRatio < 0.4) {
      flags.veryEfficientCost = true;
      costScore += 40;
      rationale.push(
        `💡 Excellent cost efficiency (${(costRatio * 100).toFixed(1)}%).`
      );
    } else if (costRatio <= 0.65 && costRatio >= 0.4) {
      costScore += 10;
      rationale.push(
        `✅ Balanced cost structure (${(costRatio * 100).toFixed(1)}%).`
      );
    }
  }

  // =========================
  // 3) تحليل المنافسين
  // =========================
  let competitorScore = 0;

  if (compStats && typeof compStats.diffPct === "number") {
    const diff = compStats.diffPct; // + => أغلى من السوق، - => أرخص من السوق

    if (compStats.position === "BELOW") {
      flags.underpricedVsMarket = true;

      if (diff < -20) {
        competitorScore += 50;
        rationale.push(
          `💚 Strong underpricing vs market (~${Math.abs(diff).toFixed(
            1
          )}%). Room to increase price.`
        );
      } else if (diff < -5) {
        competitorScore += 25;
        rationale.push(
          `💡 Slight underpricing (~${Math.abs(diff).toFixed(
            1
          )}%). Controlled increase possible.`
        );
      }
    } else if (compStats.position === "ABOVE") {
      flags.overpricedVsMarket = true;

      if (diff > 20) {
        competitorScore -= 50;
        rationale.push(
          `❗ Significantly overpriced vs market (~${diff.toFixed(1)}%).`
        );
      } else if (diff > 5) {
        competitorScore -= 25;
        rationale.push(
          `⚠️ Moderately overpriced vs market (~${diff.toFixed(1)}%).`
        );
      }
    } else {
      competitorScore += 10;
      rationale.push(`✅ In line with competitor price range.`);
    }
  }

  // =========================
  // 4) تحليل المخزون (اختياري)
  // =========================
  let stockScore = 0;

  const daysOfCover: number | null =
    typeof stock?.daysOfCover === "number" ? stock.daysOfCover : null;

  if (daysOfCover !== null) {
    if (daysOfCover < 15) {
      flags.lowStockRisk = true;
      stockScore -= 20;
      rationale.push(
        `⚠️ Low stock coverage (${daysOfCover.toFixed(
          0
        )} days). Avoid aggressive promotions.`
      );
    } else if (daysOfCover > 90) {
      flags.overStockRisk = true;
      stockScore += 30;
      rationale.push(
        `📦 High stock level (${daysOfCover.toFixed(
          0
        )} days). Consider promos or price adjustments.`
      );
    } else {
      stockScore += 5;
      rationale.push(`✅ Stock level is balanced.`);
    }
  }

  // =========================
  // 5) تجميع السكور العام حسب الـ Mode
  // =========================
  const weightByMode: Record<AIPricingMode, AIPricingScoreBlock> = {
    SAFE: {
      marginScore: 0.35,
      costScore: 0.35,
      competitorScore: 0.2,
      stockScore: 0.1,
      globalScore: 1, // dummy
    } as any,
    BALANCED: {
      marginScore: 0.3,
      costScore: 0.25,
      competitorScore: 0.3,
      stockScore: 0.15,
      globalScore: 1,
    } as any,
    AGGRESSIVE: {
      marginScore: 0.25,
      costScore: 0.15,
      competitorScore: 0.45,
      stockScore: 0.15,
      globalScore: 1,
    } as any,
  };

  const w = weightByMode[mode];

  // نحول السكور من -100..+100 إلى 0..100
  function normalizeScore(x: number): number {
    // -100 => 0, 0 => 50, 100 => 100
    return Math.max(0, Math.min(100, (x + 100) / 2));
  }

  const globalRaw =
    marginScore * (w.marginScore as any) +
    costScore * (w.costScore as any) +
    competitorScore * (w.competitorScore as any) +
    stockScore * (w.stockScore as any);

  const globalScore = normalizeScore(globalRaw);

  const scores: AIPricingScoreBlock = {
    marginScore,
    costScore,
    competitorScore,
    stockScore,
    globalScore,
  };

  // =========================
  // 6) اتخاذ القرار (Increase / Decrease / Keep)
  // =========================
  let action: AIPricingRecommendation["action"] = "KEEP";
  let suggestedChangePct = 0;
  let targetMarginPct: number | null = margin ?? null;

  const clampChange = (pct: number) => {
    // guard rails حسب الـ mode
    const maxMove =
      mode === "SAFE" ? 8 : mode === "BALANCED" ? 15 : 20; // ± %
    if (pct > maxMove) return maxMove;
    if (pct < -maxMove) return -maxMove;
    return pct;
  };

  if (flags.veryLowMargin || flags.highCostRatio || flags.veryHighCostRatio) {
    action = "INCREASE";
    const baseIncrease =
      margin !== null ? Math.max(10, 35 - margin / 2) : 8;
    suggestedChangePct = clampChange(baseIncrease);
    targetMarginPct = margin !== null ? Math.min(margin + 10, 45) : 35;
    rationale.push(
      `📈 AI suggests increasing price to improve margin and cost coverage.`
    );
  } else if (flags.overpricedVsMarket && !flags.lowMargin) {
    action = "DECREASE";
    const baseDecrease =
      compStats && typeof compStats.diffPct === "number"
        ? Math.min(15, compStats.diffPct / 2)
        : 5;
    suggestedChangePct = clampChange(-baseDecrease);
    targetMarginPct = margin !== null ? Math.max(margin - 8, 25) : null;
    rationale.push(
      `📉 AI suggests decreasing price to reduce overpricing vs competitors.`
    );
  } else if (flags.underpricedVsMarket && flags.veryEfficientCost) {
    action = "INCREASE";
    const baseIncrease =
      compStats && typeof compStats.diffPct === "number"
        ? Math.min(12, Math.abs(compStats.diffPct) / 2)
        : 5;
    suggestedChangePct = clampChange(baseIncrease);
    targetMarginPct = margin !== null ? Math.min(margin + 5, 50) : null;
    rationale.push(
      `📈 Underpriced vs market with strong cost efficiency – safe to increase price.`
    );
  } else {
    action = "KEEP";
    suggestedChangePct = 0;
    rationale.push(`✅ No strong AI signal to change price.`);
  }

  let targetNetPrice: number | null = null;
  if (baseNet !== null && suggestedChangePct !== 0) {
    targetNetPrice =
      baseNet * (1 + suggestedChangePct / 100);
  }

  const confidence =
    globalScore >= 80 ? 0.9 : globalScore >= 60 ? 0.75 : globalScore >= 40 ? 0.6 : 0.45;

  const recommendation: AIPricingRecommendation = {
    action,
    suggestedChangePct,
    minChangePct: mode === "SAFE" ? -5 : -10,
    maxChangePct: mode === "SAFE" ? 8 : mode === "BALANCED" ? 15 : 20,
    targetMarginPct,
    targetNetPrice,
    confidence,
    rationale,
  };

  return {
    product: sim.product,
    channel,
    mode,
    base,
    cost: sim.baseCost ?? null,
    competitorStats: compStats ?? null,
    stock,
    scores,
    flags,
    recommendation,
    debug: {
      rawSimulation: sim,
    },
  };
}
