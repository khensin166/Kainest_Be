// src\features\profile\services\profileController.ts
import { Context } from "hono";
import { getProfileUseCase } from "../domain/use-cases/GetProfileUseCase.js";
import { updateProfileUseCase } from "../domain/use-cases/UpdateProfileUseCase.js";
import { cloudinary } from "../../../infrastructure/cloud/cloudinaryClient.js";
import { profileRepository } from "../data/ProfileRepository.js";

export const getProfileController = async (c: Context) => {
  const userId = c.get("userId");
  const result = await getProfileUseCase(userId);
  return c.json(result);
};

// --- MODIFIKASI DIMULAI DI SINI ---
export const updateProfileController = async (c: Context) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  // --- TAMBAHAN: Logika Hapus Foto Lama ---
  // 1. Cek apakah ada avatarUrl BARU yang dikirim
  if (body.avatarUrl) {
    try {
      // 2. Ambil data profil LAMA dari database
      const currentProfileData = await profileRepository.getProfileByUserId(
        userId
      );
      // Ambil URL lama (bisa jadi null)
      const oldAvatarUrl = currentProfileData?.profile?.avatarUrl;

      // 3. Jika ada URL lama, hapus
      if (oldAvatarUrl) {
        // 4. Ekstrak 'public_id' dari URL
        // Contoh: "kainest_avatars/tqkyovmmzr754ybhhikg"
        const publicId = oldAvatarUrl
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0];

        // 5. Safety check: Hanya hapus file dari folder avatars Anda
        if (publicId.startsWith("kainest_avatars/")) {
          console.log(`Menghapus foto lama: ${publicId}`); // 6. Panggil API Cloudinary untuk menghapus
          await cloudinary.uploader.destroy(publicId);
        }
      }
    } catch (err) {
      console.error("Gagal menghapus foto lama di Cloudinary:", err); // Jangan hentikan proses, biarkan update profil tetap berjalan
    }
  } // 7. Lanjutkan alur update seperti biasa
  // --- BATAS LOGIKA TAMBAHAN ---

  const dataToUpdate = {
    name: body.name,
    displayName: body.displayName,
    avatarUrl: body.avatarUrl,
    phone_number: body.phone_number,
  };

  const result = await updateProfileUseCase(userId, dataToUpdate);
  return c.json(result);
};
// --- MODIFIKASI SELESAI ---

// --- 2. TAMBAHKAN CONTROLLER BARU INI ---
export const getUploadSignatureController = async (c: Context) => {
  try {
    // Buat timestamp (waktu saat ini dalam detik)
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Tentukan parameter yang ingin Anda "tandatangani"
    // Ini memberitahu Cloudinary: "Saya mengizinkan unggahan ke folder ini"
    const paramsToSign = {
      timestamp: timestamp,
      folder: "kainest_avatars", // Nama folder di Cloudinary (opsional tapi bagus)
    };

    // Ambil API Secret dari environment
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      throw new Error("CLOUDINARY_API_SECRET is not set");
    }

    // Buat signature
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret
    );

    // Kirim signature, timestamp, dan info lain yang dibutuhkan frontend
    return c.json({
      success: true,
      signature: signature,
      timestamp: timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    console.error("Error generating upload signature:", error);
    return c.json(
      { success: false, message: "Failed to get upload signature" },
      500
    );
  }
};
