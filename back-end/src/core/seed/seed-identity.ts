import prisma from "@src/core/prisma.js";

export async function seedIdentity() {
  console.log("🧩 Checking Brand Identity...");

  const brand = await prisma.brand.findFirst({
    where: { slug: "hairoticmen" },
  });

  if (!brand) return console.log("❌ Brand not found!");

  const existing = await prisma.brandIdentity.findFirst({
    where: { brandId: brand.id },
  });

  if (existing) {
    console.log("✔️ Brand Identity exists → Skipping.");
    return;
  }

  await prisma.brandIdentity.create({
    data: {
      brandId: brand.id,
      vision: "Leading men's grooming worldwide.",
      mission: "Empowering men with premium scientific care.",
      values: "Premium, Masculine, Confident, Scientific",
      toneOfVoice: "Strong, direct, professional.",
      persona: "Expert male grooming consultant.",
      brandStory:
        "HAIROTICMEN delivers high performance men's haircare built with science.",
      keywords: "men, haircare, beardcare, grooming, styling",
      colorPalette: "black,#d4a373,#ffffff",
      packagingStyle: "premium matte black with gold accents",
    },
  });

  console.log("🎉 Seeded Brand Identity");
}
