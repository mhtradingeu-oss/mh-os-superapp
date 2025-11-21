import prisma from "@src/core/prisma.js";
import { generatePricingMatrix } from "./pricing-auto.service.js";

type AgentMode = "DRAFT_ONLY";

type RunAgentOptions = {
  brandSlug?: string;
  limit?: number;
  mode?: AgentMode;
  minChangePct?: number; // أقل نسبة تغيير تستحق عمل Draft
};

export async function runPricingAgent(options: RunAgentOptions = {}) {
  const {
    brandSlug = "hairoticmen",
    limit = 50,
    mode = "DRAFT_ONLY",
    minChangePct = 3, // تجاهل تغييرات أقل من 3%
  } = options;

  // 1) جيب المنتجات المستهدفة
  const products = await prisma.brandProduct.findMany({
    where: brandSlug
      ? {
          brand: {
            slug: brandSlug,
          },
        }
      : {},
    select: {
      id: true,
      name: true,
      sku: true,
    },
    take: limit,
  });

  let totalAnalyzed = 0;
  let totalDrafts = 0;

  const perProductSummary: Array<{
    productId: string;
    sku: string | null;
    name: string | null;
    drafts: number;
  }> = [];

  for (const p of products) {
    totalAnalyzed++;

    const matrixResult = await generatePricingMatrix({
      productId: p.id,
    });

    if (!matrixResult) continue;

    const { matrix } = matrixResult;
    let draftsForProduct = 0;

    for (const row of matrix) {
      const channel = row.channel;
      const current = row.current;
      const recommended = row.recommended;

      if (!current || !recommended) continue;
      if (recommended.changePct == null) continue;

      const absChange = Math.abs(recommended.changePct);

      // تجاهل التغييرات الصغيرة
      if (absChange < minChangePct) continue;

      if (mode === "DRAFT_ONLY") {
        await prisma.productPriceDraft.create({
          data: {
            productId: p.id,
            channel,
            oldNet: current.net ?? null,
            oldGross: current.gross ?? null,
            oldMargin: current.marginPct ?? null,
            newNet: recommended.net ?? null,
            newGross: recommended.gross ?? null,
            newMargin: recommended.marginPct ?? null,
            changePct: recommended.changePct ?? null,
            notes:
              (row.notes && row.notes.length > 0
                ? row.notes.join(" | ")
                : null) ?? null,
          },
        });

        draftsForProduct++;
        totalDrafts++;
      }
    }

    perProductSummary.push({
      productId: p.id,
      sku: p.sku ?? null,
      name: p.name ?? null,
      drafts: draftsForProduct,
    });
  }

  return {
    mode,
    brandSlug,
    totalProductsScanned: products.length,
    totalAnalyzed,
    totalDrafts,
    perProductSummary,
  };
}
