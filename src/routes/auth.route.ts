// auth.route.ts
import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const app = new Hono()
const prisma = new PrismaClient()

// Endpoint Register
app.post('/register', async (c) => {
  const { email, password, name } = await c.req.json()
  const hashed = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: { email, password: hashed, name },
  })

  return c.json(user)
})

export default app
