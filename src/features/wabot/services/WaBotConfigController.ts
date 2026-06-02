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

export const saveBotInfoController = async (c: Context) => {
  try {
    const body = await c.req.json();
    if (!body.botPhoneNumber) {
      return c.json({ success: false, message: "Missing botPhoneNumber" }, 400);
    }
    
    const m = await import("../data/WaBotConfigRepository.js");
    const firstConfig = await m.waBotConfigRepository.getFirstConfig();
    
    if (!firstConfig) {
      return c.json({ success: false, message: "WaBotConfig is empty. Please save config first." }, 400);
    }

    const updated = await m.waBotConfigRepository.updateBotPhoneNumber(firstConfig.userId, body.botPhoneNumber);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("saveBotInfoController Error:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getBotInfoController = async (c: Context) => {
  try {
    const m = await import("../data/WaBotConfigRepository.js");
    const firstConfig = await m.waBotConfigRepository.getFirstConfig();
    
    if (!firstConfig || !firstConfig.botPhoneNumber) {
      return c.json({ success: false, message: "Bot phone number not found" }, 404);
    }

    return c.json({ success: true, botPhoneNumber: firstConfig.botPhoneNumber });
  } catch (error) {
    console.error("getBotInfoController Error:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};
