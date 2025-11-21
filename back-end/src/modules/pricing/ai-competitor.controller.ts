import { Request, Response } from "express";
import { aiCompetitorPricing } from "./ai-competitor.service.js";

export async function aiCompetitorPricingHandler(req: Request, res: Response) {
  try {
    const { sku, productId, channel } = req.query;

    const result = await aiCompetitorPricing({
      sku: sku as string,
      productId: productId as string,
      channel: channel as string,
    });

    res.json(result);
  } catch (err) {
    console.error("AI Competitor Engine ERROR:", err);
    res.status(500).json({
      status: "error",
      message: "AI Competitor Engine failed.",
    });
  }
}
