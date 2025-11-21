import prisma from "@src/core/prisma.js";

export async function seedRules() {
  console.log("📘 Checking Brand Rules...");

  const brand = await prisma.brand.findFirst({ where: { slug: "hairoticmen" } });

  if (!brand) return;

  const existing = await prisma.brandRules.findFirst({
    where: { brandId: brand.id },
  });

  if (existing) {
    console.log("✔️ Brand Rules exist → Skipping.");
    return;
  }

  await prisma.brandRules.create({
    data: {
      brandId: brand.id,
      namingRules: "Short, masculine, strong product names.",
      descriptionRules: "Focus on results, science, and masculinity.",
      messagingRules: "High confidence tone for male grooming.",
      marketingRules: "No unrealistic claims, no offensive language.",
      pricingRules: "Maintain premium positioning.",
      restrictedWords: "cheap, basic, low-quality",
    },
  });

  console.log("🎉 Seeded Brand Rules");
}
