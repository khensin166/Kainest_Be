import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { adminMiddleware } from "../../auth/presentation/adminMiddleware.js";
import { getSystemUpdatesController, syncGithubReleasesController } from "../services/systemUpdateController.js";

export const systemUpdateRoute = new Hono();

systemUpdateRoute.use("*", authMiddleware);

// GET /system-updates - fetch for dashboard
systemUpdateRoute.get("/", getSystemUpdatesController);

// POST /system-updates/sync - admin only, sync from github
systemUpdateRoute.post("/sync", adminMiddleware, syncGithubReleasesController);
