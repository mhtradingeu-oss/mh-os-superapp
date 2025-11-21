import { Request, Response } from "express";
import {
  getProductPricingById,
  getProductPricingBySku,
  simulatePricingScenario,
  type ChannelKey,
} from "./pricing.service.js";

export async function getPricingByProductIdHandler(
  req: Request,
  res: Response
) {
  try {
    const { productId } = req.params;

    const data = await getProductPricingById(productId);

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
    console.error("❌ getPricingByProductIdHandler error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch pricing",
    });
  }
}

export async function getPricingBySkuHandler(req: Request, res: Response) {
  try {
    const { sku } = req.params;

    const data = await getProductPricingBySku(sku);

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
    console.error("❌ getPricingBySkuHandler error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch pricing",
    });
  }
}

// ───────────────────────────────
//  Simulation Handler
// ───────────────────────────────

const allowedChannels: ChannelKey[] = [
  "B2C",
  "AMAZON",
  "DEALER_BASIC",
  "DEALER_PLUS",
  "STAND",
  "DISTRIBUTOR",
];

export async function simulatePricingHandler(req: Request, res: Response) {
  try {
    const { sku, productId, channel, discountPct, overrideNet, targetMarginPct } =
      req.query;

    if (!sku && !productId) {
      return res.status(400).json({
        status: "error",
        message: "sku or productId is required",
      });
    }

    if (!channel || typeof channel !== "string") {
      return res.status(400).json({
        status: "error",
        message: "channel is required",
      });
    }

    const ch = channel.toUpperCase() as ChannelKey;
    if (!allowedChannels.includes(ch)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid channel. Allowed: ${allowedChannels.join(", ")}`,
      });
    }

    const result = await simulatePricingScenario({
      sku: typeof sku === "string" ? sku : undefined,
      productId: typeof productId === "string" ? productId : undefined,
      channel: ch,
      discountPct:
        typeof discountPct === "string" ? Number(discountPct) : undefined,
      overrideNet:
        typeof overrideNet === "string" ? Number(overrideNet) : undefined,
      targetMarginPct:
        typeof targetMarginPct === "string"
          ? Number(targetMarginPct)
          : undefined,
    });

    if (!result) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    res.json({
      status: "success",
      data: result,
    });
  } catch (err) {
    console.error("❌ simulatePricingHandler error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to simulate pricing",
    });
  }
}
