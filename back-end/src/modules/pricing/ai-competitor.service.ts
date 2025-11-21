import prisma from "@src/core/prisma.js";
import { simulatePricingScenario } from "./pricing.service.js";

export async function aiCompetitorPricing(params: {
  sku?: string;
  productId?: string;
  channel?: string;
}) {
  const { sku, productId } = params;
  const channel = (params.channel || "B2C").toUpperCase();

  // 1) Load product
  const product = await prisma.brandProduct.findFirst({
    where: sku ? { sku } : { id: productId },
    include: { pricing: true },
  });

  if (!product) {
    return {
      status: "error",
      message: "Product not found.",
    };
  }

  // 2) Run internal price simulation
  const sim = await simulatePricingScenario({
    sku: product.sku || undefined,
    productId: product.id,
    channel: channel as any,
  });

  if (!sim) {
    return {
      status: "error",
      message: "Pricing simulation unavailable.",
    };
  }

  const ourNet = sim.base?.net ?? null;

  // 3) Fetch competitor prices
  const competitors = await prisma.competitorPrice.findMany({
    where: { productId: product.id },
    orderBy: { netPrice: "asc" },
  });

  if (!competitors.length || ourNet === null) {
    return {
      status: "no_competitors",
      product: { name: product.name, sku: product.sku },
      message: "No competitor pricing available.",
    };
  }

  // 4) Compute competitor stats
  const competitorValues = competitors
    .map((c) => c.netPrice)
    .filter((v): v is number => v !== null);

  const min = Math.min(...competitorValues);
  const max = Math.max(...competitorValues);
  const avg = competitorValues.reduce((a, b) => a + b, 0) / competitorValues.length;

  const diffAbs = ourNet - avg;
  const diffPct = (diffAbs / avg) * 100;

  // 5) AI Insights
  const risks: string[] = [];
  const opportunities: string[] = [];
  const suggestions: string[] = [];

  let position: "BELOW" | "ABOVE" | "IN_RANGE" = "IN_RANGE";

  if (diffPct > 12) {
    position = "ABOVE";
    risks.push(`Our price is ${diffPct.toFixed(1)}% ABOVE market average.`);
    suggestions.push(
      "Reduce price slightly or increase perceived value (bundles, free shipping, gifts)."
    );
  } else if (diffPct < -12) {
    position = "BELOW";
    opportunities.push(`We are ${Math.abs(diffPct).toFixed(1)}% BELOW competitors.`);
    suggestions.push("Opportunity to increase price by 3–10% safely.");
  } else {
    position = "IN_RANGE";
    opportunities.push("Our price is aligned with market positioning.");
  }

  // 6) Channel Strategy Rules
  if (channel === "AMAZON") {
    suggestions.push("Validate competitiveness considering FBA and referral fees.");
  }

  if (channel.includes("DEALER")) {
    suggestions.push("Dealers expect ~25% margin for resale.");
  }

  // 7) AI Pricing Health Score
  let score = 50;

  if (position === "IN_RANGE") score += 20;
  if (position === "BELOW") score += 10;
  if (position === "ABOVE") score -= 20;

  const evaluation =
    score >= 85
      ? "🏆 Excellent position"
      : score >= 60
      ? "✨ Very good"
      : score >= 45
      ? "⚠️ Needs improvement"
      : "❗ Critical";

  return {
    status: "success",
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
    },
    ourNet,
    competitorStats: {
      min,
      max,
      avg,
      diffAbs,
      diffPct,
      position,
    },
    competitors,
    aiScore: score,
    evaluation,
    notes: {
      risks,
      opportunities,
      suggestions,
    },
  };
}
