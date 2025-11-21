import prisma from "@src/core/prisma.js";

export async function seedBrand() {
  console.log("🏷 Checking HAIROTICMEN brand...");

  const existing = await prisma.brand.findFirst({
    where: { slug: "hairoticmen" },
  });

  if (existing) {
    console.log("✔️ Brand already exists → Skipping.");
    return;
  }

  await prisma.brand.create({
    data: {
      name: "HAIROTICMEN",
      slug: "hairoticmen",
      description: "Premium men's grooming and haircare brand.",
    },
  });

  console.log("🎉 Created brand: HAIROTICMEN");
}
