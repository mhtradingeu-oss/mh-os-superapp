import { Router } from "express";
import {
  getProductInsightsHandler,
  getCategoryInsightsHandler,
  getBrandInsightsHandler,
  productHeatmapHandler,
  productForecastHandler,
  productNarrativeHandler,
} from "./insights.controller.js";

const router = Router();

/**
 * 🔹 Product core insights
 * GET /api/insights/product/:productId?/:sku?
 * - يمكن تمرير productId أو sku أو الاثنين
 */
router.get("/product/:productId?/:sku?", getProductInsightsHandler);

/**
 * 🔹 Product pricing insights
 * - Heatmap
 * - Forecast
 * - Narrative
 *
 * أمثلة:
 * GET /api/insights/product/123/heatmap
 * GET /api/insights/product/123/forecast?scenario=5&channel=B2C
 * GET /api/insights/product/123/narrative?scenario=5&channel=B2C
 */
router.get("/product/:productId/heatmap", productHeatmapHandler);
router.get("/product/:productId/forecast", productForecastHandler);
router.get("/product/:productId/narrative", productNarrativeHandler);

/**
 * 🔹 Category-level insights (placeholder حاليًا)
 */
router.get("/category/:categoryId", getCategoryInsightsHandler);

/**
 * 🔹 Brand-level insights (placeholder حاليًا)
 */
router.get("/brand/:brandId", getBrandInsightsHandler);

export default router;
