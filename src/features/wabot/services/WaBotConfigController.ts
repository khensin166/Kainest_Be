import { Context } from "hono";
import { saveConfigUseCase } from "../domain/use-cases/SaveConfigUseCase.js";
import { getConfigUseCase } from "../domain/use-cases/GetConfigUseCase.js";

export const saveConfigController = async (c: Context) => {
  const userId = c.get("userId"); // Diambil dari authMiddleware
  const body = await c.req.json();

  // Validasi Input Dasar
  if (!body.baseUrl) {
    return c.json({ success: false, message: "Base URL wajib diisi" }, 400);
  }

  const result = await saveConfigUseCase(
    userId,
    body.baseUrl,
    body.adminSecret
  );

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

export const getConfigController = async (c: Context) => {
  const userId = c.get("userId");

  const result = await getConfigUseCase(userId);

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};
