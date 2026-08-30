import { planContextRepository } from "../data/PlanContextRepository.js";
import { getCycleBoundaries } from "../../../utils/cycleBoundaries.js";
import { hitungSolvabilitas } from "./solvency.js";
import { daftarTagihan } from "./billService.js";
import { totalAlokasiBelumTersetor } from "./savingService.js";

/**
 * Merangkai angka-angka anggaran dan komitmen menjadi satu zona solvabilitas.
 * Perhitungannya sendiri ada di solvency.ts sebagai fungsi murni agar bisa diuji
 * tanpa database.
 */
export async function ringkasanKesehatan(userId: string, acuan = new Date()) {
  const user = await planContextRepository.getUserBudget(userId);
  if (!user) return { success: false as const, status: 404, message: "Pengguna tidak ditemukan." };

  const { cycleStart, cycleEnd, cycleLabel, dateRangeLabel } = getCycleBoundaries(
    acuan,
    user.payday
  );

  const totalLimit = await planContextRepository.getTotalPocketLimit(userId, user.salary);
  const totalSpent = await planContextRepository.getTotalSpent(userId, cycleStart, cycleEnd);

  const sisaKantong = totalLimit - totalSpent;
  const belumDialokasikan = Math.max(0, user.salary - totalLimit);

  const hasilTagihan = await daftarTagihan(userId, acuan);
  const tagihanTerbuka = hasilTagihan.success
    ? hasilTagihan.data.bills.filter(
        (b) => b.cycleStatus === "upcoming" || b.cycleStatus === "overdue"
      )
    : [];
  const tagihanBelumLunas = tagihanTerbuka.reduce((t, b) => t + b.amount, 0);

  const alokasiTabunganBelumTersetor = await totalAlokasiBelumTersetor(userId, acuan);

  const ringkasan = hitungSolvabilitas({
    sisaKantong,
    belumDialokasikan,
    tagihanBelumLunas,
    alokasiTabunganBelumTersetor,
  });

  return {
    success: true as const,
    data: {
      cycle: { label: cycleLabel, dateRange: dateRangeLabel },
      salary: user.salary,
      payday: user.payday,
      ...ringkasan,
      /** Tagihan yang masih terbuka, terdekat dulu — untuk pesan peringatan. */
      openBills: tagihanTerbuka
        .slice()
        .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0))
        .map((b) => ({
          id: b.id,
          name: b.name,
          amount: b.amount,
          dueDate: b.dueDate,
          daysUntilDue: b.daysUntilDue,
          cycleStatus: b.cycleStatus,
          installment:
            b.totalInstallments != null
              ? `${b.paidInstallments}/${b.totalInstallments}`
              : null,
        })),
    },
  };
}
