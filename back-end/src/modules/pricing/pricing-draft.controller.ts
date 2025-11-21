import { Request, Response } from "express";
import { savePriceDraft } from "./pricing-draft.service.js";

export async function savePriceDraftHandler(req: Request, res: Response) {
  try {
    const draft = await savePriceDraft(req.body);

    res.json({
      status: "success",
      draft,
    });
  } catch (err) {
    console.error("❌ Save draft error:", err);

    res.status(500).json({
      status: "error",
      message: "Failed to save price draft",
    });
  }
}
