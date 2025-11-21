import { Router } from "express";
import { login, register } from "@src/modules/auth/auth.controller.js";
import { authGuard } from "@src/modules/auth/auth.middleware.js";

const router = Router();

// تسجيل
router.post("/register", register);

// دخول
router.post("/login", login);

// مثال على مسار محمي
router.get("/me", authGuard, (req, res) => {
  // @ts-ignore
  const user = req.user;
  return res.json({
    status: "success",
    user,
  });
});

export default router;

