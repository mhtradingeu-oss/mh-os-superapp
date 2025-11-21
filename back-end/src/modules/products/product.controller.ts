import { Request, Response } from "express";
import { getProductBySlug, listProducts } from "./product.service.js";

export async function listProductsHandler(req: Request, res: Response) {
  try {
    const {
      brandSlug,
      categorySlug,
      line,
      status,
      search,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page,
      pageSize,
      includePricing,
      aiRank,
    } = req.query;

    const result = await listProducts({
      brandSlug: brandSlug as string | undefined,
      categorySlug: categorySlug as string | undefined,
      line: line as string | undefined,
      status: status as string | undefined,
      search: search as string | undefined,
      minPrice:
        typeof minPrice === "string" ? Number(minPrice) || undefined : undefined,
      maxPrice:
        typeof maxPrice === "string" ? Number(maxPrice) || undefined : undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder === "desc" ? "desc" : "asc",
      page: typeof page === "string" ? Number(page) || 1 : 1,
      pageSize:
        typeof pageSize === "string" ? Number(pageSize) || 20 : 20,
      includePricing: includePricing === "true",
      useAIRanking: aiRank === "true", // 👈 هنا السر
    });

    res.json({
      status: "success",
      ...result,
    });
  } catch (err) {
    console.error("❌ listProductsHandler error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to list products",
    });
  }
}

export async function getProductBySlugHandler(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const includePricing =
      typeof req.query.includePricing === "string"
        ? req.query.includePricing === "true"
        : true;

    const product = await getProductBySlug(slug, includePricing);

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    res.json({
      status: "success",
      product,
    });
  } catch (err) {
    console.error("❌ getProductBySlugHandler error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch product",
    });
  }
}
