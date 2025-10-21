// LoginUserUseCase.ts
import { userRepository } from '../../data/UserRepository'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const loginUserUseCase = async (data: { email: string; password: string }) => {
  const user = await userRepository.findByEmail(data.email)
  if (!user) return { success: false, message: 'User not found' }

  const match = await bcrypt.compare(data.password, user.password)
  if (!match) return { success: false, message: 'Invalid credentials' }

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
  return { success: true, token }
}
