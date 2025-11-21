import { Router } from "express";
import {
  getProductBySlugHandler,
  listProductsHandler,
} from "./product.controller.js";

const router = Router();

// GET /api/v1/products
router.get("/", listProductsHandler);

// GET /api/v1/products/:slug
router.get("/:slug", getProductBySlugHandler);

export default router;
