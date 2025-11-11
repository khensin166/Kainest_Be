import { userRepository } from '../../data/UserRepository.js'
import bcrypt from 'bcryptjs'

export const changePasswordUseCase = async (userId: string, data: { currentPassword: string, newPassword: string }) => {
  // 1. Ambil data user lengkap (termasuk hash password)
  // Kita perlu buat fungsi baru di repository
  const user = await userRepository.findUserWithPassword(userId);
  if (!user) {
    return { success: false, status: 404, message: 'User not found' }
  }

  // 2. Verifikasi password saat ini
  const isMatch = await bcrypt.compare(data.currentPassword, user.password);
  if (!isMatch) {
    return { success: false, status: 400, message: 'Password saat ini salah.' }
  }

  // 3. Hash password baru
  const newHashedPassword = await bcrypt.hash(data.newPassword, 10);

  // 4. Update database
  await userRepository.updatePassword(userId, newHashedPassword);

  return { success: true, message: 'Password successfully updated' }
}