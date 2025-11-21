import { Router } from "express";
import {
  addProduct,
  getSingleProduct,
  listBrandProducts,
  removeProduct,
  updateProduct,
} from "./product.controller.js";
import { authGuard, roleGuard } from "@src/modules/auth/auth.middleware.js";
import { Role } from "@prisma/client";

const router = Router();

// Admin فقط يضيف منتج
router.post(
  "/:brandSlug/products",
  authGuard,
  roleGuard([Role.ADMIN]),
  addProduct
);

// عرض كل منتجات براند
router.get("/:brandSlug/products", listBrandProducts);

// منتج واحد بالـ slug
router.get("/product/:productSlug", getSingleProduct);

// تحديث منتج
router.put(
  "/product/:productSlug",
  authGuard,
  roleGuard([Role.ADMIN]),
  updateProduct
);

// حذف منتج
router.delete(
  "/product/:productSlug",
  authGuard,
  roleGuard([Role.ADMIN]),
  removeProduct
);

export default router;
