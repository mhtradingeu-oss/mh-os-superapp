import prisma from "@src/core/prisma.js";
import { aiCompetitorPricing } from "./ai-competitor.service.js";
import { simulatePricingScenario } from "./pricing.service.js";

export async function generateCompetitorStrategy(brandSlug = "hairoticmen") {
  // 1) Fetch brand products
  const products = await prisma.brandProduct.findMany({
    where: {
      brand: { slug: brandSlug },
    },
    include: {
      pricing: true,
      competitorPrices: true,
    },
  });

  const strategyReport: any[] = [];
  let globalRisks: string[] = [];
  let globalOpportunities: string[] = [];
  let globalSuggestions: string[] = [];

  for (const p of products) {
    // Run competitor engine for each product
    const competitorAI = await aiCompetitorPricing({
      productId: p.id,
      channel: "B2C",
    });

    const sim = await simulatePricingScenario({
      productId: p.id,
      channel: "B2C",
    });

    const ourNet = competitorAI?.ourNet ?? null;
    const avgMarket = competitorAI?.competitorStats?.avg ?? null;
    const position = competitorAI?.competitorStats?.position ?? null;

    // Build per-product strategy
    const productStrategy = {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      position,
      ourNetPrice: ourNet,
      competitorAvg: avgMarket,
      insights: competitorAI?.notes ?? {},
      strategicAction: "",
    };

    // Decision logic
    if (position === "ABOVE") {
      productStrategy.strategicAction =
        "🔻 Reduce price slightly (3–8%) or add more value (bundles, freebies, loyalty points).";
      globalRisks.push(
        `Product ${p.name} is overpriced vs market (~${competitorAI?.competitorStats?.diffPct?.toFixed(
          1
        )}% above).`
      );
      globalSuggestions.push(
        `Review HAIROTICMEN pricing policy for premium positioning consistency.`
      );
    }

    if (position === "BELOW") {
      productStrategy.strategicAction =
        "🔺 Opportunity to increase price (2–10%) without losing share.";
      const diff = competitorAI?.competitorStats?.diffPct;
      const diffDisplay = Number.isFinite(diff)
      ? `${Math.abs(diff!).toFixed(1)}%` : "N/A";
      globalOpportunities.push(
      `Product ${p.name} is underpriced (~${diffDisplay}).`
       );

    }
       

    if (position === "IN_RANGE") {
      productStrategy.strategicAction = "✔ Maintain pricing — optimal competitive position.";
      globalOpportunities.push(
        `Product ${p.name} is perfectly aligned with competitors.`
      );
    }

    strategyReport.push(productStrategy);
  }

  // Consolidated brand-level strategy
  const brandStrategy = {
    brand: brandSlug,
    timestamp: new Date(),
    summary: {
      globalRisks: [...new Set(globalRisks)],
      globalOpportunities: [...new Set(globalOpportunities)],
      globalSuggestions: [...new Set(globalSuggestions)],
    },
    products: strategyReport,
    strategicRecommendation: "",
  };

  // Final AI-level strategic recommendation
  const risksCount = brandStrategy.summary.globalRisks.length;
  const oppCount = brandStrategy.summary.globalOpportunities.length;

  if (risksCount > oppCount) {
    brandStrategy.strategicRecommendation =
      "⚠ Brand is overpriced on multiple product lines. Consider a recalibration strategy.";
  } else if (oppCount > risksCount * 1.5) {
    brandStrategy.strategicRecommendation =
      "🔥 Major opportunity to increase pricing across several SKUs.";
  } else {
    brandStrategy.strategicRecommendation =
      "✨ Balanced price position. Minor optimization recommended.";
  }

  return brandStrategy;
}
