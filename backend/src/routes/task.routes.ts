import { Router } from "express";
import { env } from "../config/env.js";
import { taskController } from "../controllers/task.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const aiGuidanceRateLimit = createRateLimitMiddleware({
  windowMs: env.aiRateLimitWindowMs,
  maxRequests: env.aiRateLimitMax,
  message: "AI guidance limit reached. Please wait a moment before requesting more help.",
  keyPrefix: "ai-guidance",
});

router.use(authMiddleware);

router.get("/", asyncHandler(taskController.getTasks));
router.post("/", asyncHandler(taskController.createTask));
router.put("/:taskId", asyncHandler(taskController.updateTask));
router.patch("/:taskId", asyncHandler(taskController.updateTask));
router.delete("/:taskId", asyncHandler(taskController.deleteTask));
router.post("/:taskId/guidance", aiGuidanceRateLimit, asyncHandler(taskController.generateGuidance));

export default router;
