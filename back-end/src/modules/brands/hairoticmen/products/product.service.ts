import prisma from "@src/core/prisma";

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId?: string | null;
}

export const createProduct = async (
  brandSlug: string,
  data: CreateProductInput
) => {
  const brand = await prisma.brand.findFirst({
    where: { slug: brandSlug },
  });

  if (!brand) {
    throw new Error("BRAND_NOT_FOUND");
  }

  const slug = data.name.toLowerCase().replace(/\s+/g, "-");

  const product = await prisma.brandProduct.create({
    data: {
      name: data.name,
      slug,
      description: data.description || "",
      price: Number(data.price || 0),
      imageUrl: data.imageUrl || null,
      brandId: brand.id,
      categoryId: data.categoryId || null,
    },
  });

  return product;
};

export const listProducts = async (brandSlug: string) => {
  const brand = await prisma.brand.findFirst({
    where: { slug: brandSlug },
  });

  if (!brand) {
    throw new Error("BRAND_NOT_FOUND");
  }

  return prisma.brandProduct.findMany({
    where: { brandId: brand.id },
    include: {
      category: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getProductBySlug = async (productSlug: string) => {
  return prisma.brandProduct.findFirst({
    where: { slug: productSlug },
    include: {
      category: true,
      brand: true,
    },
  });
};

export const updateProductBySlug = async (
  productSlug: string,
  data: Partial<CreateProductInput>
) => {
  const existing = await prisma.brandProduct.findFirst({
    where: { slug: productSlug },
  });

  if (!existing) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const updated = await prisma.brandProduct.update({
    where: { id: existing.id },
    data: {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      price: data.price !== undefined ? Number(data.price) : existing.price,
      imageUrl: data.imageUrl ?? existing.imageUrl,
      categoryId:
        data.categoryId !== undefined ? data.categoryId : existing.categoryId,
    },
  });

  return updated;
};

export const deleteProductBySlug = async (productSlug: string) => {
  const existing = await prisma.brandProduct.findFirst({
    where: { slug: productSlug },
  });

  if (!existing) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  await prisma.brandProduct.delete({
    where: { id: existing.id },
  });

  return true;
};
