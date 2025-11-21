import prisma from "@src/core/prisma.js";
import { analyzeProductInsights } from "./insights.helpers.js";

export async function getProductInsights({ productId, sku }) {
  let product = null;

  if (productId) {
    product = await prisma.brandProduct.findUnique({
      where: { id: productId },
      include: {
        pricing: true,
        competitorPrices: true,
        priceHistory: true,
        learningJournal: true,
      },
    });
  } else if (sku) {
    product = await prisma.brandProduct.findFirst({
      where: { sku },
      include: {
        pricing: true,
        competitorPrices: true,
        priceHistory: true,
        learningJournal: true,
      },
    });
  }

  if (!product) return null;

  // تحليل الذكاء
  const insights = analyzeProductInsights(product);

  return {
    product,
    insights,
  };
}
