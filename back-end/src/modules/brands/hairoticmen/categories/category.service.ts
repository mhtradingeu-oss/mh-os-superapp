import prisma from "@src/core/prisma.js";

export const createCategory = async (brandSlug: string, name: string) => {
  const brand = await prisma.brand.findFirst({
    where: { slug: brandSlug },
  });

  if (!brand) throw new Error("BRAND_NOT_FOUND");

  const slug = name.toLowerCase().replace(/\s+/g, "-");

  return prisma.brandCategory.create({
    data: {
      name,
      slug,
      brandId: brand.id,
    },
  });
};

export const getCategories = async (brandSlug: string) => {
  const brand = await prisma.brand.findFirst({
    where: { slug: brandSlug },
  });

  if (!brand) throw new Error("BRAND_NOT_FOUND");

  return prisma.brandCategory.findMany({
    where: { brandId: brand.id },
  });
};
