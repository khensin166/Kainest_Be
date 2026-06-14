import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { getFeedbacksController, createFeedbackController, toggleFeedbackVisibilityController } from "../services/feedbackController.js";
import { adminMiddleware } from "../../auth/presentation/adminMiddleware.js";
export const feedbackRoute = new Hono();
feedbackRoute.use("*", authMiddleware);
// GET /feedbacks - ambil semua feedback yang visible (untuk dashboard)
feedbackRoute.get("/", getFeedbacksController);
// POST /feedbacks - kirim feedback baru
feedbackRoute.post("/", createFeedbackController);
// PATCH /feedbacks/:id/visibility - (Admin) toggle visibility
feedbackRoute.patch("/:id/visibility", adminMiddleware, toggleFeedbackVisibilityController);
