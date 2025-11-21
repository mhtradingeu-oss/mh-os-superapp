import { Router } from "express";
import {
  getPricingByProductIdHandler,
  getPricingBySkuHandler,
  simulatePricingHandler,
} from "./pricing.controller.js";
import { pricingAdviceHandler } from "./pricing-advisor.controller.js";
import { pricingAutoMatrixHandler } from "./pricing-auto.controller.js";
import { savePriceDraftHandler } from "./pricing-draft.controller.js";
import { runPricingAgentHandler } from "./pricing-agent.controller.js";
import { competitorInsightsHandler } from "./pricing-competitor.controller.js";
import { aiCompetitorPricingHandler } from "./ai-competitor.controller.js";
import { competitorStrategyHandler } from "./ai-competitor-strategy.controller.js";
import { aiRepriceHandler } from "./ai-repricing.controller.js";


const router = Router();

// Pricing by productId
router.get("/product/:productId", getPricingByProductIdHandler);

// Pricing by SKU
router.get("/sku/:sku", getPricingBySkuHandler);

// Simulation
router.get("/simulate", simulatePricingHandler);

// AI Advisor
router.get("/advice", pricingAdviceHandler);

// Advanced AI Price Matrix
router.get("/auto-matrix", pricingAutoMatrixHandler);

// Save price draft manually
router.post("/draft/save", savePriceDraftHandler);

// 🔥 Autonomous AI Pricing Agent (V5)
router.post("/agent/run", runPricingAgentHandler);

router.get("/ai-competitor", aiCompetitorPricingHandler);

router.get("/ai-competitor-strategy", competitorStrategyHandler);

router.get("/ai-reprice", aiRepriceHandler);

export default router;
