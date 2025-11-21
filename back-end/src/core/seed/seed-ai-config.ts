import prisma from "@src/core/prisma.js";

export async function seedAIConfig() {
  console.log("🤖 Checking AI Config...");

  const brand = await prisma.brand.findFirst({ where: { slug: "hairoticmen" } });

  if (!brand) return;

  const existing = await prisma.brandAIConfig.findFirst({
    where: { brandId: brand.id },
  });

  if (existing) {
    console.log("✔️ AI Config exists → Skipping.");
    return;
  }

  await prisma.brandAIConfig.create({
    data: {
      brandId: brand.id,
      aiPersonality: "masculine, expert, confident",
      aiVoiceStyle: "direct and authoritative",
      aiContentStyle: "premium grooming expert",
      aiPricingStyle: "semi-autonomous",
      aiEnabledActions: "generateContent,pricingSuggestions",
      aiBlockedTopics: "medicalClaims",
      aiModelVersion: "gpt-5.1",
      aiTone: "confident-high-end",
    },
  });

  console.log("🎉 Seeded Brand AI Config");
}
