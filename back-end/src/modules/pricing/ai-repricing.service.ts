import prisma from "@src/core/prisma.js";
import { savePriceDraft } from "./pricing-draft.service.js";
import { simulatePricingScenario } from "./pricing.service.js";

/**
 * AI Repricing Engine – Exported EXACTLY as runAIRepricing
 */
export async function runAIRepricing(mode: "safe" | "auto" = "safe") {
  console.log(`🤖 AI Repricing Engine Running — Mode: ${mode}`);

  const products = await prisma.brandProduct.findMany({
    include: { pricing: true, competitorPrices: true },
  });

  const drafts: any[] = [];
  const skipped: any[] = [];

  for (const product of products) {
    try {
      const sim = await simulatePricingScenario({
        productId: product.id,
        channel: "B2C" as any,
      });

      if (!sim?.base?.net || !sim?.baseCost?.value) {
        skipped.push({ productId: product.id, reason: "missing_pricing" });
        continue;
      }

      const base = sim.base;
      const net = base.net;
      const margin = base.marginPct ?? 0;
      const cost = sim.baseCost.value;

      let adj = 0;

      if (margin < 25) adj += 0.10;
      else if (margin < 30) adj += 0.05;
      else if (margin > 55) adj -= 0.08;

      if (product.competitorPrices?.length > 0) {
        const avg = product.competitorPrices.reduce((s, c) => s + c.price, 0) /
          product.competitorPrices.length;

        if (net > avg * 1.15) adj -= 0.05;
        if (net < avg * 0.85) adj += 0.05;
      }

      if (mode === "safe") {
        adj = Math.max(Math.min(adj, 0.06), -0.06);
      }

      if (Math.abs(adj) < 0.01) {
        skipped.push({ productId: product.id, reason: "tiny_change" });
        continue;
      }

      const newNet = net * (1 + adj);
      const newGross = newNet * 1.19;
      const newMargin = ((newNet - cost) / newNet) * 100;

      const draft = await savePriceDraft({
        productId: product.id,
        channel: "B2C",
        oldNet: net,
        oldGross: base.gross,
        oldMargin: margin,
        newNet,
        newGross,
        newMargin,
        changePct: adj * 100,
        notes: "AI Auto-Repricing",
      });

      drafts.push(draft);

      if (mode === "auto") {
        await prisma.productPricing.update({
          where: { productId: product.id },
          data: { b2cStoreNet: newNet, b2cStoreInc: newGross },
        });
      }
    } catch (err) {
      console.error("Error processing product:", err);
      skipped.push({ productId: product.id, reason: "error" });
    }
  }

  return { status: "ok", mode, drafts, skipped };
}
