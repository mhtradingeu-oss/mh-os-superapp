import { Prisma } from "@prisma/client";
import prisma from "@src/core/prisma.js";
import { rankProductsWithAI } from "./product.ai.js";

/**
 * ✨ Normalize Search Query
 * Removes symbols, trims spaces, lowercases, and normalizes everything.
 */
function normalizeSearchQuery(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/gi, "") // remove non-alphanumeric
    .replace(/\s+/g, " "); // normalize spaces
}

export type ProductListFilters = {
  brandSlug?: string;
  categorySlug?: string;
  line?: string;
  status?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "name" | "price" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  includePricing?: boolean;
  useAIRanking?: boolean; // 👈 جديد
};

export async function listProducts(filters: ProductListFilters) {
  const {
    brandSlug,
    categorySlug,
    line,
    status,
    search,
    minPrice,
    maxPrice,
    sortBy = "name",
    sortOrder = "asc",
    page = 1,
    pageSize = 20,
    includePricing = false,
    useAIRanking = false,
  } = filters;

  const where: Prisma.BrandProductWhereInput = {};

  // Filter by brand
  if (brandSlug) {
    where.brand = { slug: brandSlug };
  }

  // Filter by category
  if (categorySlug) {
    where.category = { slug: categorySlug };
  }

  // Filter by product line (Premium / Professional)
  if (line) {
    where.line = line;
  }

  // Filter by status
  if (status) {
    where.status = status;
  }

  // 🔍 Smart Search
  let q: string | null = null;
  if (search) {
    q = normalizeSearchQuery(search);

    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { upc: { contains: q, mode: "insensitive" } },
      { line: { contains: q, mode: "insensitive" } },
    ];
  }

  // Price filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) {
      where.price.gte = minPrice;
    }
    if (maxPrice !== undefined) {
      where.price.lte = maxPrice;
    }
  }

  // Sorting configuration
  const allowedSort: Array<
    keyof Prisma.BrandProductOrderByWithRelationInput
  > = ["name", "price", "createdAt"];

  const sortField: keyof Prisma.BrandProductOrderByWithRelationInput =
    allowedSort.includes(sortBy) ? sortBy : "name";

  const safeSortOrder: "asc" | "desc" =
    sortOrder === "desc" ? "desc" : "asc";

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  // Fetch products
  const [rawItems, total] = await Promise.all([
    prisma.brandProduct.findMany({
      where,
      include: {
        brand: true,
        category: true,
        pricing: includePricing,
      },
      orderBy:
        search && useAIRanking
          ? undefined // 🔥 سنرتب بالـ AI بعدين
          : { [sortField]: safeSortOrder },

      skip,
      take,
    }),

    prisma.brandProduct.count({ where }),
  ]);

  let items: any[] = rawItems;

  // ⭐ Smart Relevance Scoring (بدون AI)
  if (q && !useAIRanking) {
    items = rawItems
      .map((item) => {
        let score = 0;
        const name = item.name?.toLowerCase() || "";
        const desc = item.description?.toLowerCase() || "";
        const sku = item.sku?.toLowerCase() || "";
        const upc = item.upc?.toLowerCase() || "";
        const lineVal = item.line?.toLowerCase() || "";

        if (name.includes(q)) score += 5;
        if (sku.includes(q)) score += 5;
        if (desc.includes(q)) score += 3;
        if (upc.includes(q)) score += 2;
        if (lineVal.includes(q)) score += 1;

        return { ...item, relevanceScore: score };
      })
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  }

  // 🤖 AI Ranking Layer
  if (q && useAIRanking) {
    try {
      items = await rankProductsWithAI(q, rawItems);
    } catch (err) {
      console.error("❌ AI ranking failed, falling back to default:", err);
    }
  }

  return {
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      searchQuery: search || null,
      aiRanking: useAIRanking,
    },
    items,
  };
}

export async function getProductBySlug(slug: string, includePricing = true) {
  return prisma.brandProduct.findUnique({
    where: { slug },
    include: {
      brand: true,
      category: true,
      pricing: includePricing,
    },
  });
}
