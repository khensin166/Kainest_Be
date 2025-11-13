// authController.ts
import { Context } from "hono";
import { registerUserUseCase } from "../domain/use-cases/RegisterUserUseCase.js";
import { loginUserUseCase } from "../domain/use-cases/LoginUserUseCase.js";
import { getMeUseCase } from "../domain/use-cases/GetMeUseCase.js";
import { changePasswordUseCase } from "../domain/use-cases/ChangePasswordUseCase.js";

export const registerController = async (c: Context) => {
  const body = await c.req.json();
  const result = await registerUserUseCase(body);
  return c.json(result);
};

export const loginController = async (c: Context) => {
  const body = await c.req.json();
  const result = await loginUserUseCase(body);
  return c.json(result);
};

export const getMeController = async (c: Context) => {
  // Ambil 'userId' dari context (yang di-set oleh authMiddleware)
  const userId = c.get("userId");

  // Sebenarnya middleware sudah menjaga ini, tapi cek lagi untuk keamanan
  if (!userId) {
    return c.json({ success: false, message: "Authentication required" }, 401);
  }

  const result = await getMeUseCase(userId);
  return c.json(result);
};

export const changePasswordController = async (c: Context) => {
  const userId = c.get("userId");
  const body = await c.req.json(); // Pastikan input ada

  if (
    !body.currentPassword ||
    !body.newPassword ||
    !body.confirmationPassword
  ) {
    // --- PERBAIKAN 1 ---
    c.status(400); // 1. Atur status
    return c.json({ success: false, message: "Semua field wajib diisi" }); // 2. Kembalikan JSON
  } // Validasi

  if (body.newPassword !== body.confirmationPassword) {
    // --- PERBAIKAN 2 ---
    c.status(400); // 1. Atur status
    return c.json({
      success: false,
      message: "Konfirmasi password baru tidak cocok",
    }); // 2. Kembalikan JSON
  }

  const result = await changePasswordUseCase(userId, body);

  if (!result.success) {
    c.status(result.status as any);
    return c.json({ success: false, message: result.message });
  }

  return c.json(result); 
};
