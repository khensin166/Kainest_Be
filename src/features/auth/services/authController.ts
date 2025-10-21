// authController.ts
import { Context } from 'hono'
import { registerUserUseCase } from '../domain/use-cases/RegisterUserUseCase'
import { loginUserUseCase } from '../domain/use-cases/LoginUserUseCase'

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
