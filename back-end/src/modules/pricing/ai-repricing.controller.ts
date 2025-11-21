import { Request, Response } from "express";
import { runAIRepricing } from "./ai-repricing.service.js";

export async function aiRepriceHandler(req: Request, res: Response) {
  try {
    const mode = (req.query.mode as string) || "safe";

    const data = await runAIRepricing(mode === "auto" ? "auto" : "safe");

    res.json({
      status: "success",
      mode,
      result: data,
    });
  } catch (e) {
    console.error("AI Repricing Error:", e);
    res.status(500).json({ status: "error", message: "Failed to run repricing" });
  }
}
