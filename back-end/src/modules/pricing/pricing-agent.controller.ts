import { Request, Response } from "express";
import { runPricingAgent } from "./pricing-agent.service.js";

export async function runPricingAgentHandler(req: Request, res: Response) {
  try {
    const { brandSlug, limit, minChangePct } = req.query;

    const result = await runPricingAgent({
      brandSlug:
        typeof brandSlug === "string" && brandSlug.length > 0
          ? brandSlug
          : "hairoticmen",
      limit: limit ? Number(limit) : 50,
      minChangePct: minChangePct ? Number(minChangePct) : 3,
      mode: "DRAFT_ONLY",
    });

    res.json({
      status: "success",
      data: result,
    });
  } catch (err) {
    console.error("❌ runPricingAgentHandler error:", err);
    res.status(500).json({
      status: "error",
      message: "Autonomous Pricing Agent failed",
    });
  }
}
