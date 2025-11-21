import type { Request, Response } from "express";

import { getProductInsights } from "./insights.service.js";
import { getProductHeatmap } from "./product-heatmap.service.js";
import { forecastProductPricing } from "./product-forecast.service.js";
import { buildProductNarrative } from "./product-narrative.service.js";
import type { ChannelKey } from "./product-heatmap.service.js";

/**
 * GET /api/insights/product/:productId?/:sku?
 * يحضر إنسايتس أساسية عن المنتج (V9/V10 core insights)
 */
export async function getProductInsightsHandler(req: Request, res: Response) {
  try {
    const productId = (req.params.productId as string | undefined) ?? null;
    const sku = (req.params.sku as string | undefined) ?? null;

    const data = await getProductInsights({ productId, sku });

    if (!data) {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    return res.json({ status: "success", insights: data });
  } catch (err) {
    console.error("❌ Product Insights Error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
}

/**
 * GET /api/insights/category/:categoryId
 * placeholder إلى أن نطبّق منطق الإنسايتس على مستوى الكاتيجوري
 */
export async function getCategoryInsightsHandler(req: Request, res: Response) {
  return res.json({ message: "Category Insights — to be implemented" });
}

/**
 * GET /api/insights/brand/:brandId
 * placeholder إلى أن نطبّق منطق الإنسايتس على مستوى البراند
 */
export async function getBrandInsightsHandler(req: Request, res: Response) {
  return res.json({ message: "Brand Insights — to be implemented" });
}

/**
 * GET /api/insights/products/:productId/heatmap
 * خريطة حرارة للمنتج عبر القنوات / التسعير / المخزون
 */
export async function productHeatmapHandler(req: Request, res: Response) {
  try {
    const { productId } = req.params;

    const result = await getProductHeatmap(productId);

    if (!result) {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    return res.json({ status: "success", data: result });
  } catch (err) {
    console.error("❌ productHeatmapHandler error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal error" });
  }
}

/**
 * GET /api/insights/products/:productId/forecast?scenario=5&channel=B2C
 * توقع تسعيري/بيعي بسيط لسِناريو ±X% على السعر
 */
export async function productForecastHandler(req: Request, res: Response) {
  try {
    const { productId } = req.params;
    const scenarioPct = Number(req.query.scenario ?? 5);

    const channel = req.query.channel
      ? (req.query.channel as ChannelKey)
      : undefined;

    const result = await forecastProductPricing({
      productId,
      scenarioPct,
      channel,
    });

    if (!result) {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    return res.json({ status: "success", data: result });
  } catch (err) {
    console.error("❌ productForecastHandler error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal error" });
  }
}

/**
 * GET /api/insights/products/:productId/narrative?scenario=5&channel=B2C
 * Narrative ذكي يشرح حالة المنتج والتسعير
 */
export async function productNarrativeHandler(req: Request, res: Response) {
  try {
    const { productId } = req.params;

    const channel =
      (req.query.channel as ChannelKey | undefined) ?? ("B2C" as ChannelKey);

    const scenarioPct = req.query.scenario
      ? Number(req.query.scenario)
      : 5;

    const result = await buildProductNarrative({
      productId,
      primaryChannel: channel,
      scenarioPct,
    });

    if (!result) {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    return res.json({ status: "success", data: result });
  } catch (err) {
    console.error("❌ productNarrativeHandler error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal error" });
  }
}
