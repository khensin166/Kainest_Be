import { Context, Next } from 'hono'
import jwt from 'jsonwebtoken' // Gunakan package yang sama dengan saat login

// Tentukan bentuk data di dalam token Anda
interface JwtPayload {
  id: string
  email: string
}

export const authMiddleware = async (c: Context, next: Next) => {
  // 1. Ambil header Authorization
  const authHeader = c.req.header('Authorization')
  
  // 2. Cek apakah header ada dan formatnya benar
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Authorization header missing or invalid' }, 401)
  }

  // 3. Ambil token-nya (setelah "Bearer ")
  const token = authHeader.split(' ')[1]
  const secret = process.env.JWT_SECRET || 'secret' // Pastikan ini SAMA dengan di login

  try {
    // 4. Verifikasi token
    const payload = jwt.verify(token, secret) as JwtPayload
    
    // 5. Simpan ID pengguna di 'context' Hono agar bisa dipakai controller
    c.set('userId', payload.id) 

    await next() // Lanjut ke controller jika token valid

  } catch (error) {
    // Tangkap error jika token tidak valid (misal: kadaluwarsa, signature salah)
    console.error('JWT Verification Error:', error)
    return c.json({ success: false, message: 'Invalid or expired token' }, 401)
  }
}