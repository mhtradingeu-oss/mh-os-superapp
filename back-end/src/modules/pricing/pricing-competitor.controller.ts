import { Request, Response } from "express";
import { getCompetitorInsights } from "./pricing-competitor.service.js";

export async function competitorInsightsHandler(req: Request, res: Response) {
  try {
    const { sku, productId, channel } = req.query as {
      sku?: string;
      productId?: string;
      channel?: string;
    };

    const result = await getCompetitorInsights({
      sku,
      productId,
      channel: channel || "B2C",
    });

    if (result.status === "error") {
      return res.status(404).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error("❌ Competitor pricing error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal error while computing competitor insights.",
    });
  }
}
