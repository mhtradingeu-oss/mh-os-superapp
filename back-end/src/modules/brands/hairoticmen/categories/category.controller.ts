import { Request, Response } from "express";
import { createCategory, getCategories } from "./category.service.js";

export const createBrandCategory = async (req: Request, res: Response) => {
  try {
    const { brandSlug } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ status: "error", message: "Name required" });
    }

    const category = await createCategory(brandSlug, name);

    return res.json({ status: "success", category });
  } catch (error: any) {
    console.error("Category creation error:", error);

    if (error.message === "BRAND_NOT_FOUND") {
      return res.status(404).json({ status: "error", message: "Brand not found" });
    }

    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

export const listBrandCategories = async (req: Request, res: Response) => {
  try {
    const { brandSlug } = req.params;

    const categories = await getCategories(brandSlug);

    return res.json({ status: "success", categories });
  } catch (error: any) {
    console.error("Category list error:", error);

    if (error.message === "BRAND_NOT_FOUND") {
      return res.status(404).json({ status: "error", message: "Brand not found" });
    }

    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};
