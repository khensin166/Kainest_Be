import { Context } from 'hono'
import { getProfileUseCase } from '../domain/use-cases/GetProfileUseCase.js'
import { updateProfileUseCase } from '../domain/use-cases/UpdateProfileUseCase.js'
import { cloudinary } from '../../../infrastructure/cloud/cloudinaryClient.js'


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
    avatarUrl: body.avatarUrl,
    phone_number: body.phone_number
  }

  const result = await updateProfileUseCase(userId, dataToUpdate)
  return c.json(result)
}

// --- 2. TAMBAHKAN CONTROLLER BARU INI ---
export const getUploadSignatureController = async (c: Context) => {
  try {
    // Buat timestamp (waktu saat ini dalam detik)
    const timestamp = Math.round(new Date().getTime() / 1000)

    // Tentukan parameter yang ingin Anda "tandatangani"
    // Ini memberitahu Cloudinary: "Saya mengizinkan unggahan ke folder ini"
    const paramsToSign = {
      timestamp: timestamp,
      folder: 'kainest_avatars' // Nama folder di Cloudinary (opsional tapi bagus)
    }

    // Ambil API Secret dari environment
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!apiSecret) {
      throw new Error('CLOUDINARY_API_SECRET is not set')
    }

    // Buat signature
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret)

    // Kirim signature, timestamp, dan info lain yang dibutuhkan frontend
    return c.json({
      success: true,
      signature: signature,
      timestamp: timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME
    })

  } catch (error) {
    console.error('Error generating upload signature:', error)
    return c.json({ success: false, message: 'Failed to get upload signature' }, 500)
  }
}