import { Context } from 'hono'
import { getProfileUseCase } from '../domain/use-cases/GetProfileUseCase.js'
import { updateProfileUseCase } from '../domain/use-cases/UpdateProfileUseCase.js'

export const getProfileController = async (c: Context) => {
  const userId = c.get('userId')
  const result = await getProfileUseCase(userId)
  return c.json(result)
}

export const updateProfileController = async (c: Context) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  
  // Ambil hanya field yang diizinkan
  const dataToUpdate = {
    name: body.name,
    displayName: body.displayName,
    avatarUrl: body.avatarUrl
  }

  const result = await updateProfileUseCase(userId, dataToUpdate)
  return c.json(result)
}