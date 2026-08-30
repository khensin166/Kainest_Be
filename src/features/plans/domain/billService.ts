import { billRepository, type BillInput } from "../data/BillRepository.js";
import { planContextRepository } from "../data/PlanContextRepository.js";
import { getCycleBoundaries } from "../../../utils/cycleBoundaries.js";
import {
  cariJatuhTempoDiSiklus,
  frekuensiDidukung,
  periodeSiklus,
  sisaHari,
  type BillFrequencyInput,
} from "./billCycle.js";

export type StatusSiklus = "upcoming" | "overdue" | "paid" | "skipped" | "not_due";

export type Hasil<T> =
  | { success: true; data: T }
  | { success: false; status: number; message: string };

const gagal = (status: number, message: string): Hasil<never> => ({
  success: false,
  status,
  message,
});

/** Validasi masukan tagihan. Dikembalikan sebagai pesan, bukan exception. */
function validasi(data: Partial<BillInput>, wajibLengkap: boolean): string | null {
  if (wajibLengkap) {
    if (!data.name?.trim()) return "Nama tagihan wajib diisi.";
    if (!data.categoryId) return "Kategori wajib dipilih.";
    if (!data.amount || data.amount <= 0) return "Nominal tagihan harus lebih dari 0.";
    if (!data.dueDay) return "Tanggal jatuh tempo wajib diisi.";
  }
  if (data.dueDay != null && (data.dueDay < 1 || data.dueDay > 31)) {
    return "Tanggal jatuh tempo harus antara 1 sampai 31.";
  }
  if (data.dueMonth != null && (data.dueMonth < 1 || data.dueMonth > 12)) {
    return "Bulan jatuh tempo harus antara 1 sampai 12.";
  }
  if (data.frequency === "YEARLY" && !data.dueMonth) {
    return "Tagihan tahunan wajib menyertakan bulan jatuh tempo.";
  }
  if (data.frequency && !frekuensiDidukung(data.frequency as BillFrequencyInput)) {
    return "Frekuensi mingguan belum didukung. Satu siklus gajian memuat lebih dari satu jatuh tempo, sehingga pelunasannya belum bisa dicatat dengan benar.";
  }
  if (data.totalInstallments != null && data.totalInstallments < 1) {
    return "Jumlah angsuran minimal 1.";
  }
  if (data.reminderDaysBefore != null && (data.reminderDaysBefore < 0 || data.reminderDaysBefore > 30)) {
    return "Pengingat hanya bisa disetel 0 sampai 30 hari sebelum jatuh tempo.";
  }
  return null;
}

/** Menggabungkan tagihan dengan keadaannya pada siklus berjalan. */
export async function daftarTagihan(userId: string, acuan = new Date()) {
  const user = await planContextRepository.getUserBudget(userId);
  if (!user) return gagal(404, "Pengguna tidak ditemukan.");

  const tagihan = await billRepository.findByUser(userId);
  const period = periodeSiklus(acuan, user.payday);
  const { dateRangeLabel, cycleLabel } = getCycleBoundaries(acuan, user.payday);
  const pelunasan = await billRepository.findPayments(
    tagihan.map((t) => t.id),
    period
  );
  const petaPelunasan = new Map(pelunasan.map((p) => [p.billId, p]));

  const items = tagihan.map((t) => {
    const jatuhTempo = cariJatuhTempoDiSiklus(
      {
        frequency: t.frequency as BillFrequencyInput,
        dueDay: t.dueDay,
        dueMonth: t.dueMonth,
        startDate: t.startDate,
      },
      acuan,
      user.payday
    );
    const bayar = petaPelunasan.get(t.id);

    let statusSiklus: StatusSiklus;
    if (bayar) {
      statusSiklus = bayar.status === "PAID" ? "paid" : "skipped";
    } else if (t.status !== "ACTIVE" || !jatuhTempo) {
      statusSiklus = "not_due";
    } else {
      statusSiklus = sisaHari(jatuhTempo, acuan) < 0 ? "overdue" : "upcoming";
    }

    return {
      id: t.id,
      name: t.name,
      amount: t.amount,
      frequency: t.frequency,
      dueDay: t.dueDay,
      dueMonth: t.dueMonth,
      startDate: t.startDate,
      note: t.note,
      status: t.status,
      reminderDaysBefore: t.reminderDaysBefore,
      totalInstallments: t.totalInstallments,
      paidInstallments: t.paidInstallments,
      category: t.category
        ? { id: t.category.id, name: t.category.name, icon: t.category.icon }
        : null,
      dueDate: jatuhTempo,
      daysUntilDue: jatuhTempo ? sisaHari(jatuhTempo, acuan) : null,
      cycleStatus: statusSiklus,
      paidAmount: bayar?.paidAmount ?? null,
    };
  });

  return {
    success: true as const,
    data: {
      cycle: { label: cycleLabel, dateRange: dateRangeLabel, period },
      bills: items,
    },
  };
}

/** Total tagihan yang belum tertutup pada siklus ini — dipakai penjaga solvabilitas. */
export async function totalTagihanBelumLunas(userId: string, acuan = new Date()) {
  const hasil = await daftarTagihan(userId, acuan);
  if (!hasil.success) return 0;
  return hasil.data.bills
    .filter((b) => b.cycleStatus === "upcoming" || b.cycleStatus === "overdue")
    .reduce((total, b) => total + b.amount, 0);
}

export async function buatTagihan(userId: string, data: BillInput) {
  const pesan = validasi(data, true);
  if (pesan) return gagal(400, pesan);
  const dibuat = await billRepository.create(userId, {
    ...data,
    startDate: data.startDate ?? new Date(),
  });
  return { success: true as const, data: dibuat };
}

export async function ubahTagihan(userId: string, billId: string, data: Partial<BillInput>) {
  const tagihan = await billRepository.findById(billId);
  if (!tagihan || tagihan.userId !== userId) return gagal(404, "Tagihan tidak ditemukan.");
  const pesan = validasi(data, false);
  if (pesan) return gagal(400, pesan);
  return { success: true as const, data: await billRepository.update(billId, data) };
}

export async function hapusTagihan(userId: string, billId: string) {
  const tagihan = await billRepository.findById(billId);
  if (!tagihan || tagihan.userId !== userId) return gagal(404, "Tagihan tidak ditemukan.");
  await billRepository.remove(billId);
  return { success: true as const, data: { id: billId } };
}

/**
 * Melunasi tagihan pada siklus berjalan.
 *
 * Nominal boleh dikoreksi: listrik didaftarkan Rp350.000 tapi tagihan aslinya
 * Rp412.000 — yang tercatat sebagai pengeluaran harus Rp412.000, sementara
 * perkiraan di tagihan tetap Rp350.000.
 */
export async function lunasiTagihan(
  userId: string,
  billId: string,
  opsi: { amount?: number; date?: Date } = {},
  acuan = new Date()
) {
  const user = await planContextRepository.getUserBudget(userId);
  if (!user) return gagal(404, "Pengguna tidak ditemukan.");

  const tagihan = await billRepository.findById(billId);
  if (!tagihan || tagihan.userId !== userId) return gagal(404, "Tagihan tidak ditemukan.");
  if (tagihan.status !== "ACTIVE") return gagal(400, "Tagihan ini sudah tidak aktif.");

  const period = periodeSiklus(acuan, user.payday);
  const sudahAda = await billRepository.findPayment(billId, period);
  if (sudahAda) return gagal(409, "Tagihan ini sudah ditandai untuk siklus berjalan.");

  const nominal = opsi.amount && opsi.amount > 0 ? opsi.amount : tagihan.amount;
  const angsuranKe = tagihan.totalInstallments ? tagihan.paidInstallments + 1 : null;
  const selesaikanTenor =
    tagihan.totalInstallments != null &&
    tagihan.paidInstallments + 1 >= tagihan.totalInstallments;

  const hasil = await billRepository.pay({
    billId,
    userId,
    categoryId: tagihan.categoryId,
    period,
    amount: nominal,
    date: opsi.date ?? acuan,
    note: angsuranKe
      ? `${tagihan.name} (angsuran ${angsuranKe}/${tagihan.totalInstallments})`
      : tagihan.name,
    installmentNo: angsuranKe,
    selesaikanTenor,
  });

  return { success: true as const, data: hasil };
}

/** Melewati tagihan: tercatat, tetapi budget tidak berkurang sama sekali. */
export async function lewatiTagihan(userId: string, billId: string, acuan = new Date()) {
  const user = await planContextRepository.getUserBudget(userId);
  if (!user) return gagal(404, "Pengguna tidak ditemukan.");

  const tagihan = await billRepository.findById(billId);
  if (!tagihan || tagihan.userId !== userId) return gagal(404, "Tagihan tidak ditemukan.");

  const period = periodeSiklus(acuan, user.payday);
  const sudahAda = await billRepository.findPayment(billId, period);
  if (sudahAda) return gagal(409, "Tagihan ini sudah ditandai untuk siklus berjalan.");

  return { success: true as const, data: await billRepository.skip(billId, userId, period) };
}

/** Membatalkan penandaan siklus ini; transaksi terkait ikut terhapus. */
export async function batalkanPenandaan(userId: string, billId: string, acuan = new Date()) {
  const user = await planContextRepository.getUserBudget(userId);
  if (!user) return gagal(404, "Pengguna tidak ditemukan.");

  const tagihan = await billRepository.findById(billId);
  if (!tagihan || tagihan.userId !== userId) return gagal(404, "Tagihan tidak ditemukan.");

  const period = periodeSiklus(acuan, user.payday);
  const dibatalkan = await billRepository.cancelPayment(billId, period);
  if (!dibatalkan) return gagal(404, "Belum ada penandaan untuk siklus ini.");
  return { success: true as const, data: dibatalkan };
}
