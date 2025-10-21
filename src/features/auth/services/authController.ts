// authController.ts
import { Context } from 'hono'
import { registerUserUseCase } from '../domain/use-cases/RegisterUserUseCase.js'
import { loginUserUseCase } from '../domain/use-cases/LoginUserUseCase.js'

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
