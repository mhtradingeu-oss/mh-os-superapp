import prisma from "@src/core/prisma.js";

export async function seedProducts() {
  console.log("🧴 Checking Products...");

  const brand = await prisma.brand.findFirst({ where: { slug: "hairoticmen" } });

  if (!brand) return;

  const products = [
    {
      name: "Hair Tonic 250ml",
      price: 19.99,
      category: "Treatments",
    },
    {
      name: "Hair Serum 150ml",
      price: 24.99,
      category: "Hair Care",
    },
    {
      name: "Matte Styling Clay",
      price: 14.99,
      category: "Styling",
    },
    {
      name: "Beard Oil Original",
      price: 12.99,
      category: "Beard Care",
    },
    {
      name: "Anti Hair-Loss Ampoules",
      price: 39.99,
      category: "Treatments",
    },
  ];

  for (const p of products) {
    const slug = p.name.toLowerCase().replace(/\s+/g, "-");

    const category = await prisma.brandCategory.findFirst({
      where: { name: p.category },
    });

    const existing = await prisma.brandProduct.findFirst({ where: { slug } });
    if (existing) continue;

    await prisma.brandProduct.create({
      data: {
        name: p.name,
        slug,
        price: p.price,
        description: `Premium ${p.name} by HAIROTICMEN.`,
        brandId: brand.id,
        categoryId: category?.id || null,
        imageUrl: "https://example.com/hairoticmen/product.jpg",
      },
    });

    console.log(`✔️ Created Product: ${p.name}`);
  }

  console.log("🎉 Products Seeding Done");
}
