import { Request, Response } from "express";
import { generatePricingMatrix } from "./pricing-auto.service.js";

export async function pricingAutoMatrixHandler(req: Request, res: Response) {
  try {
    const { sku, productId } = req.query;

    if (!sku && !productId) {
      return res.status(400).json({
        status: "error",
        message: "sku or productId is required",
      });
    }

    const data = await generatePricingMatrix({
      sku: typeof sku === "string" ? sku : undefined,
      productId: typeof productId === "string" ? productId : undefined,
    });

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    res.json({
      status: "success",
      data,
    });
  } catch (err) {
    console.error("❌ pricingAutoMatrixHandler error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to generate pricing matrix",
    });
  }
}
