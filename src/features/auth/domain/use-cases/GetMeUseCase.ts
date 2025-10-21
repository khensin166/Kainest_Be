import { userRepository } from '../../data/UserRepository.js'

export const getMeUseCase = async (userId: string) => {
  // Panggil repository dengan ID yang didapat dari token
  const user = await userRepository.findById(userId)

  if (!user) {
    return { success: false, message: 'User not found' }
  }

  // user sudah aman (tanpa password) berkat 'select' di repository
  return { success: true, user }
}