import { runAIPricingEngine } from "./ai-engine.service.js";

export async function getPricingAdvice(params: {
  sku?: string;
  productId?: string;
  channel: string;
  mode?: "SAFE" | "BALANCED" | "AGGRESSIVE";
}) {
  const result = await runAIPricingEngine(params);

  if (!result) return null;

  return {
    product: result.product,
    channel: result.channel,
    mode: result.mode,
    basePricing: result.base,
    cost: result.cost,
    scores: result.scores,
    flags: result.flags,
    recommendation: result.recommendation,
    competitorStats: result.competitorStats,
    stock: result.stock,
  };
}
