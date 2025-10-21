// authRoute.ts
import { Hono } from 'hono'
import { registerController, loginController } from '../services/authController.js'

export const authRoute = new Hono()

authRoute.post('/register', registerController)
authRoute.post('/login', loginController)
