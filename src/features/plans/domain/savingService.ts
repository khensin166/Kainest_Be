import { savingGoalRepository, type GoalInput } from "../data/SavingGoalRepository.js";
import { planContextRepository } from "../data/PlanContextRepository.js";
import { periodeSiklus } from "./billCycle.js";
import type { SavingGoalStatus } from "@prisma/client";

type Gagal = { success: false; status: number; message: string };
const gagal = (status: number, message: string): Gagal => ({ success: false, status, message });

function validasi(data: Partial<GoalInput>, wajibLengkap: boolean): string | null {
  if (wajibLengkap) {
    if (!data.name?.trim()) return "Nama wishlist wajib diisi.";
    if (!data.targetAmount || data.targetAmount <= 0) return "Target harus lebih dari 0.";
  }
  if (data.targetAmount != null && data.targetAmount <= 0) return "Target harus lebih dari 0.";
  if (data.monthlyAllocation != null && data.monthlyAllocation < 0) {
    return "Alokasi bulanan tidak boleh negatif.";
  }
  return null;
}

/** Bulan berjalan sejak setoran pertama; minimal 1 agar tidak membagi dengan nol. */
function bulanBerjalan(sejak: Date | null, acuan: Date): number {
  if (!sejak) return 1;
  const bulan =
    (acuan.getFullYear() - sejak.getFullYear()) * 12 + (acuan.getMonth() - sejak.getMonth()) + 1;
  return Math.max(1, bulan);
}

export async function daftarWishlist(userId: string, acuan = new Date()) {
  const goals = await savingGoalRepository.findByUser(userId);
  const totals = await savingGoalRepository.sumByGoal(goals.map((g) => g.id));

  const items = await Promise.all(
    goals.map(async (g) => {
      const terkumpul = totals.get(g.id) ?? 0;
      const sisa = Math.max(0, g.targetAmount - terkumpul);
      const persen = g.targetAmount > 0
        ? Math.min(100, Math.round((terkumpul / g.targetAmount) * 1000) / 10)
        : 0;

      // Laju = rata-rata terkumpul per bulan sejak setoran pertama. Kalau belum
      // ada setoran sama sekali, alokasi bulanan dipakai sebagai perkiraan.
      const sejak = await savingGoalRepository.firstContributionDate(g.id);
      const laju = terkumpul > 0 ? terkumpul / bulanBerjalan(sejak, acuan) : g.monthlyAllocation;
      const bulanLagi = laju > 0 ? Math.ceil(sisa / laju) : null;

      let perkiraanSelesai: Date | null = null;
      if (bulanLagi != null && sisa > 0) {
        perkiraanSelesai = new Date(acuan.getFullYear(), acuan.getMonth() + bulanLagi, 1);
      }

      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        targetAmount: g.targetAmount,
        monthlyAllocation: g.monthlyAllocation,
        targetDate: g.targetDate,
        status: g.status,
        collectedAmount: terkumpul,
        remainingAmount: sisa,
        progressPercent: persen,
        monthsToFinish: sisa > 0 ? bulanLagi : 0,
        estimatedFinish: perkiraanSelesai,
        /** True bila ada tenggat dan proyeksinya melewatinya. */
        behindTarget:
          g.targetDate != null && perkiraanSelesai != null
            ? perkiraanSelesai > g.targetDate
            : false,
      };
    })
  );

  return { success: true as const, data: items };
}

/**
 * Total alokasi wishlist yang belum tertutup setoran pada siklus ini.
 *
 * Alokasi adalah niat, setoran adalah kenyataan — keduanya dibedakan, persis
 * seperti BudgetPocket.limitAmount dibedakan dari Transaction. Yang menjadi
 * komitmen hanyalah selisihnya.
 */
export async function totalAlokasiBelumTersetor(userId: string, acuan = new Date()) {
  const user = await planContextRepository.getUserBudget(userId);
  if (!user) return 0;

  const goals = await savingGoalRepository.findByUser(userId, "ACTIVE");
  if (goals.length === 0) return 0;

  const period = periodeSiklus(acuan, user.payday);
  const tersetor = await savingGoalRepository.sumByGoalForPeriod(
    goals.map((g) => g.id),
    period
  );

  return goals.reduce((total, g) => {
    const sudah = tersetor.get(g.id) ?? 0;
    return total + Math.max(0, g.monthlyAllocation - sudah);
  }, 0);
}

/** Total alokasi bulanan wishlist aktif — mengurangi `unallocated` di ringkasan. */
export async function totalAlokasiBulanan(userId: string) {
  const goals = await savingGoalRepository.findByUser(userId, "ACTIVE");
  return goals.reduce((total, g) => total + g.monthlyAllocation, 0);
}

export async function buatWishlist(userId: string, data: GoalInput) {
  const pesan = validasi(data, true);
  if (pesan) return gagal(400, pesan);
  return { success: true as const, data: await savingGoalRepository.create(userId, data) };
}

export async function ubahWishlist(userId: string, goalId: string, data: Partial<GoalInput>) {
  const goal = await savingGoalRepository.findById(goalId);
  if (!goal || goal.userId !== userId) return gagal(404, "Wishlist tidak ditemukan.");
  const pesan = validasi(data, false);
  if (pesan) return gagal(400, pesan);
  return { success: true as const, data: await savingGoalRepository.update(goalId, data) };
}

export async function hapusWishlist(userId: string, goalId: string) {
  const goal = await savingGoalRepository.findById(goalId);
  if (!goal || goal.userId !== userId) return gagal(404, "Wishlist tidak ditemukan.");
  await savingGoalRepository.remove(goalId);
  return { success: true as const, data: { id: goalId } };
}

export async function ubahStatusWishlist(
  userId: string,
  goalId: string,
  status: SavingGoalStatus
) {
  const goal = await savingGoalRepository.findById(goalId);
  if (!goal || goal.userId !== userId) return gagal(404, "Wishlist tidak ditemukan.");
  return { success: true as const, data: await savingGoalRepository.update(goalId, { status }) };
}

/**
 * Menyetor ke wishlist. Nominal negatif berarti penarikan — dicatat sebagai
 * baris tersendiri agar riwayatnya jujur, bukan dengan menghapus setoran lama.
 *
 * Setoran ini TIDAK membuat Transaction: tabungan adalah pemindahan, bukan
 * konsumsi. Mencatatnya sebagai EXPENSE akan mencemari totalSpent, grafik tren,
 * dan evaluasi AI sekaligus.
 */
export async function setorWishlist(
  userId: string,
  goalId: string,
  opsi: { amount: number; note?: string | null; date?: Date },
  acuan = new Date()
) {
  if (!opsi.amount || opsi.amount === 0) return gagal(400, "Nominal setoran tidak boleh 0.");

  const user = await planContextRepository.getUserBudget(userId);
  if (!user) return gagal(404, "Pengguna tidak ditemukan.");

  const goal = await savingGoalRepository.findById(goalId);
  if (!goal || goal.userId !== userId) return gagal(404, "Wishlist tidak ditemukan.");

  if (opsi.amount < 0) {
    const totals = await savingGoalRepository.sumByGoal([goalId]);
    const terkumpul = totals.get(goalId) ?? 0;
    if (terkumpul + opsi.amount < 0) {
      return gagal(400, "Penarikan melebihi jumlah yang terkumpul.");
    }
  }

  const tanggal = opsi.date ?? acuan;
  const setoran = await savingGoalRepository.addContribution({
    goalId,
    userId,
    amount: opsi.amount,
    source: opsi.amount < 0 ? "WITHDRAWAL" : "MANUAL",
    note: opsi.note ?? null,
    date: tanggal,
    period: periodeSiklus(tanggal, user.payday),
  });

  // Target tercapai berhenti memotong budget, tapi tidak dihapus — pengguna
  // sendiri yang memutuskan kapan mengarsipkannya.
  const totals = await savingGoalRepository.sumByGoal([goalId]);
  const terkumpul = totals.get(goalId) ?? 0;
  if (goal.status === "ACTIVE" && terkumpul >= goal.targetAmount) {
    await savingGoalRepository.update(goalId, { status: "ACHIEVED" });
  }

  return { success: true as const, data: setoran };
}

export async function riwayatSetoran(userId: string, goalId: string) {
  const goal = await savingGoalRepository.findById(goalId);
  if (!goal || goal.userId !== userId) return gagal(404, "Wishlist tidak ditemukan.");
  return { success: true as const, data: await savingGoalRepository.contributions(goalId) };
}
