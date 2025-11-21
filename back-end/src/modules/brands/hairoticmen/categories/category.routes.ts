import { Router } from "express";
import { createBrandCategory, listBrandCategories } from "./category.controller.js";
import { authGuard } from "@src/modules/auth/auth.middleware.js";

const router = Router();

// ADMIN Protected
router.post("/:brandSlug/categories", authGuard, createBrandCategory);

// Public or protected (your choice)
// هنا سنجعله عام للعرض
router.get("/:brandSlug/categories", listBrandCategories);

export default router;
