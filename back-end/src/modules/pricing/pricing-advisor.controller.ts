import { Request, Response } from "express";
import { getPricingAdvice } from "./pricing-advisor.service.js";

export async function pricingAdviceHandler(req: Request, res: Response) {
  try {
    const { sku, productId, channel } = req.query;

    if (!channel)
      return res.status(400).json({
        status: "error",
        message: "channel is required",
      });

    const data = await getPricingAdvice({
      sku: sku ? String(sku) : undefined,
      productId: productId ? String(productId) : undefined,
      channel: String(channel),
    });

    if (!data)
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });

    res.json({ status: "success", data });
  } catch (err) {
    console.error("❌ AI Pricing Advisor Error:", err);
    res.status(500).json({
      status: "error",
      message: "AI Pricing Advisor failed",
    });
  }
}
