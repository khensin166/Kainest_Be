import { AdminRepository } from "../../data/admin.repository.js";
import { processUserReset } from "../../../budgeting/services/MonthlyResetCron.js";

export class TriggerMonthlyResetUseCase {
  constructor(private adminRepository: AdminRepository) {}

  async execute(targetUserId: string) {
    if (!targetUserId) {
      return { success: false, message: "targetUserId is required." };
    }

    try {
      const user = await this.adminRepository.getUserForReset(targetUserId);

      if (!user) {
        return { success: false, message: "Target user not found." };
      }

      // Jalankan proses reset untuk user tersebut
      // prosesUserReset ini berjalan secara asynchronous
      await processUserReset(user);

      return {
        success: true,
        message: `Berhasil men-trigger monthly reset untuk user ${user.name || user.id}. Pesan ringkasan akan dikirim jika terkonfigurasi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Terjadi kesalahan saat memproses manual trigger.",
        error: error.message,
      };
    }
  }
}
