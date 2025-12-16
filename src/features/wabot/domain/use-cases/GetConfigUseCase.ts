import { waBotConfigRepository } from '../../data/WaBotConfigRepository.js';

export const getConfigUseCase = async (userId: string) => {
  try {
    const config = await waBotConfigRepository.getConfig(userId);
    return { success: true, data: config };
  } catch (error) {
    console.error("Get Config Error:", error);
    return { success: false, status: 500, message: 'Gagal mengambil konfigurasi bot.' };
  }
};