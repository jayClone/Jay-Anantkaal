import { Router } from "express";
import { env } from "../config/env.js";
import { authController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const authRateLimit = createRateLimitMiddleware({
  windowMs: env.authRateLimitWindowMs,
  maxRequests: env.authRateLimitMax,
  message: "Too many authentication attempts. Please try again shortly.",
  keyPrefix: "auth",
});

router.post("/register", authRateLimit, asyncHandler(authController.register));
router.post("/login", authRateLimit, asyncHandler(authController.login));
router.post("/oauth/google", authRateLimit, asyncHandler(authController.google));
router.get("/me", authMiddleware, asyncHandler(authController.me));
router.post(
  "/change-password",
  authMiddleware,
  authRateLimit,
  asyncHandler(authController.changePassword),
);

export default router;
