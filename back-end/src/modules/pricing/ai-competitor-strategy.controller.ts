import { Request, Response } from "express";
import { generateCompetitorStrategy } from "./ai-competitor-strategy.service.js";

export async function competitorStrategyHandler(req: Request, res: Response) {
  try {
    const brand = (req.query.brand as string) || "hairoticmen";

    const result = await generateCompetitorStrategy(brand);

    res.json({
      status: "success",
      strategy: result,
    });
  } catch (err) {
    console.error("❌ Strategy Generator Error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to generate competitor strategy.",
    });
  }
}
