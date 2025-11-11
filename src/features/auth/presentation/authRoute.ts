// authRoute.ts
import { Hono } from "hono";
import {
  registerController,
  loginController,
  getMeController,
  changePasswordController,
} from "../services/authController.js";
import { authMiddleware } from "./authMiddleware.js";

export const authRoute = new Hono();

authRoute.post("/register", registerController);
authRoute.post("/login", loginController);
authRoute.get("/me", authMiddleware, getMeController);
authRoute.put("/password", authMiddleware, changePasswordController);
