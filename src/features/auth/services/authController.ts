// authController.ts
import { Context } from 'hono'
import { registerUserUseCase } from '../domain/use-cases/RegisterUserUseCase.js'
import { loginUserUseCase } from '../domain/use-cases/LoginUserUseCase.js'
import { getMeUseCase } from '../domain/use-cases/GetMeUseCase.js'

export const registerController = async (c: Context) => {
  const body = await c.req.json()
  const result = await registerUserUseCase(body)
  return c.json(result)
}

export const loginController = async (c: Context) => {
  const body = await c.req.json()
  const result = await loginUserUseCase(body)
  return c.json(result)
}

export const getMeController = async (c: Context) => {
  // Ambil 'userId' dari context (yang di-set oleh authMiddleware)
  const userId = c.get('userId')

  // Sebenarnya middleware sudah menjaga ini, tapi cek lagi untuk keamanan
  if (!userId) {
    return c.json({ success: false, message: 'Authentication required' }, 401)
  }

  const result = await getMeUseCase(userId)
  return c.json(result)
}