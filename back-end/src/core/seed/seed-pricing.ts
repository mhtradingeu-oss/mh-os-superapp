import prisma from "@src/core/prisma.js";

export async function seedPricing() {
  console.log("💰 Checking Pricing Structure...");

  const brand = await prisma.brand.findFirst({ where: { slug: "hairoticmen" } });

  if (!brand) return;

  const existing = await prisma.brandPricing.findFirst({
    where: { brandId: brand.id },
  });

  if (existing) {
    console.log("✔️ Pricing already exists → Skipping.");
    return;
  }

  await prisma.brandPricing.create({
    data: {
      brandId: brand.id,
      costMultiplier: 1.0,
      wholesaleMultiplier: 2.0,
      retailMultiplier: 1.5,
      standDiscount: 0.15,
      onlineDiscount: 0.10,
      dealerDiscount: 0.20,
      loyaltyEarnRate: 0.03,
      loyaltyRedeemRate: 0.02,
      aiDynamicPricing: true,
      aiMarketFactor: 1.0,
      aiCompetitionFactor: 0.8,
    },
  });

  console.log("🎉 Seeded Pricing Structure");
}
