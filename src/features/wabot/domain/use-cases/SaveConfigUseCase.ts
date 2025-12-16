import { waBotConfigRepository } from '../../data/WaBotConfigRepository.js';

export const saveConfigUseCase = async (userId: string, baseUrl: string, adminSecret?: string) => {
  // Validasi URL sederhana (Logika Bisnis)
  if (!baseUrl.startsWith('http')) {
    return { success: false, status: 400, message: 'URL tidak valid. Harus diawali http/https.' };
  }

  try {
    // Normalisasi data: Hapus slash di akhir
    const cleanUrl = baseUrl.replace(/\/$/, ""); 
    
    const config = await waBotConfigRepository.upsertConfig(userId, cleanUrl, adminSecret);
    return { success: true, data: config };
  } catch (error) {
    console.error("Save Config Error:", error);
    return { success: false, status: 500, message: 'Gagal menyimpan konfigurasi bot.' };
  }
};