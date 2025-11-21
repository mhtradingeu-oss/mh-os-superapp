import prisma from "@src/core/prisma.js";

export async function seedCategories() {
  console.log("📦 Checking Categories...");

  const brand = await prisma.brand.findFirst({ where: { slug: "hairoticmen" } });

  if (!brand) return;

  const categories = [
    "Hair Care",
    "Styling",
    "Beard Care",
    "Treatments",
    "Accessories",
  ];

  for (const cat of categories) {
    const slug = cat.toLowerCase().replace(/\s+/g, "-");

    const exists = await prisma.brandCategory.findFirst({ where: { slug } });

    if (!exists) {
      await prisma.brandCategory.create({
        data: {
          name: cat,
          slug,
          brandId: brand.id,
        },
      });
      console.log(`✔️ Created Category: ${cat}`);
    }
  }

  console.log("🎉 Categories Seeding Done");
}
