/**
 * src/features/plans/domain/billCycle.ts
 *
 * Memetakan tanggal jatuh tempo tagihan ke SIKLUS PAYDAY pengguna.
 *
 * Ini bagian paling mudah salah di seluruh fitur tagihan. Tagihan disimpan
 * dengan `dueDay` dalam pengertian kalender (tanggal 5, tanggal 25), sementara
 * anggaran berjalan mengikuti siklus payday. Kalau `dueDay` diperlakukan sebagai
 * bulan kalender begitu saja, tagihan masuk ke siklus yang salah — dan karena
 * BillPayment dijaga @@unique([billId, period]), pelunasan yang sah bisa ditolak
 * database.
 *
 * Contoh yang membuat perbedaannya nyata:
 *   payday 25, tagihan jatuh tempo tanggal 5.
 *   Siklus 25 Agu - 24 Sep memuat tanggal 5 SEPTEMBER, bukan 5 Agustus.
 *   Jadi tagihan tanggal 5 itu milik siklus yang DIMULAI bulan sebelumnya.
 */
import { getCycleBoundaries } from "../../../utils/cycleBoundaries.js";

/** Hari terakhir suatu bulan (month 0-indexed). */
function hariTerakhir(tahun: number, bulan: number): number {
  return new Date(tahun, bulan + 1, 0).getDate();
}

/**
 * Membentuk tanggal jatuh tempo pada bulan tertentu, dengan capping ke hari
 * terakhir bila bulannya lebih pendek. Tagihan tanggal 31 di bulan Februari
 * jatuh tempo di hari terakhir Februari, bukan meluber ke Maret.
 */
function tanggalDiBulan(tahun: number, bulan: number, dueDay: number): Date {
  return new Date(tahun, bulan, Math.min(dueDay, hariTerakhir(tahun, bulan)), 0, 0, 0, 0);
}

export type BillFrequencyInput = "MONTHLY" | "WEEKLY" | "YEARLY" | "ONE_TIME";

export interface BillCycleInput {
  frequency: BillFrequencyInput;
  /** 1-31, diisi pengguna. */
  dueDay: number;
  /** 1-12, hanya dipakai saat frequency = YEARLY. */
  dueMonth?: number | null;
  /** Tagihan tidak berlaku sebelum tanggal ini. */
  startDate: Date;
}

/**
 * Frekuensi yang belum didukung Fase 2.
 *
 * WEEKLY sengaja ditolak, bukan disetengah-implementasikan: dalam satu siklus
 * payday sebuah tagihan mingguan jatuh tempo empat sampai lima kali, sementara
 * BillPayment hanya mengizinkan satu pelunasan per siklus
 * (@@unique([billId, period])). Mendukungnya butuh keputusan desain tersendiri,
 * dan tidak ada yang memintanya.
 */
export const FREKUENSI_BELUM_DIDUKUNG: BillFrequencyInput[] = ["WEEKLY"];

export function frekuensiDidukung(frequency: BillFrequencyInput): boolean {
  return !FREKUENSI_BELUM_DIDUKUNG.includes(frequency);
}

/**
 * Mencari tanggal jatuh tempo tagihan di dalam siklus yang sedang berjalan.
 *
 * @param bill   Data jatuh tempo tagihan
 * @param acuan  Waktu referensi (biasanya `new Date()`)
 * @param payday Tanggal gajian pengguna (1-31)
 * @returns Tanggal jatuh tempo dalam siklus ini, atau null bila tagihan tidak
 *          jatuh tempo di siklus ini (mis. tagihan tahunan di bulan lain, atau
 *          tagihan sekali bayar yang tanggalnya di luar siklus).
 */
export function cariJatuhTempoDiSiklus(
  bill: BillCycleInput,
  acuan: Date,
  payday: number
): Date | null {
  if (!frekuensiDidukung(bill.frequency)) return null;

  const { cycleStart, cycleEnd } = getCycleBoundaries(acuan, payday);
  const didalamSiklus = (d: Date) => d >= cycleStart && d <= cycleEnd;

  // Tagihan belum berlaku bila siklus ini berakhir sebelum tanggal mulainya.
  if (cycleEnd < bill.startDate) return null;

  if (bill.frequency === "ONE_TIME") {
    // Sekali bayar: tanggalnya sudah pasti, tinggal dicek masuk siklus atau tidak.
    const jatuhTempo = tanggalDiBulan(
      bill.startDate.getFullYear(),
      bill.startDate.getMonth(),
      bill.dueDay
    );
    return didalamSiklus(jatuhTempo) ? jatuhTempo : null;
  }

  if (bill.frequency === "YEARLY") {
    if (!bill.dueMonth) return null;
    const bulan = bill.dueMonth - 1; // dueMonth 1-12 -> Date 0-indexed
    // Satu siklus bisa menyeberangi pergantian tahun, jadi kedua tahun dicoba.
    for (const tahun of [cycleStart.getFullYear(), cycleEnd.getFullYear()]) {
      const jatuhTempo = tanggalDiBulan(tahun, bulan, bill.dueDay);
      if (didalamSiklus(jatuhTempo)) return jatuhTempo;
    }
    return null;
  }

  // MONTHLY. Siklus payday selalu menyeberangi dua bulan kalender, dan tanggal
  // jatuh tempo muncul tepat sekali di antara keduanya. Bulan cycleStart dicoba
  // lebih dulu; bila tanggalnya sudah lewat, berarti yang berlaku bulan cycleEnd.
  const kandidat = [
    tanggalDiBulan(cycleStart.getFullYear(), cycleStart.getMonth(), bill.dueDay),
    tanggalDiBulan(cycleEnd.getFullYear(), cycleEnd.getMonth(), bill.dueDay),
  ];
  for (const jatuhTempo of kandidat) {
    if (didalamSiklus(jatuhTempo) && jatuhTempo >= bill.startDate) return jatuhTempo;
  }
  return null;
}

/**
 * Kunci siklus untuk BillPayment.period dan SavingContribution.period.
 *
 * Sengaja meneruskan `period` dari getCycleBoundaries alih-alih menghitung
 * sendiri, supaya kuncinya selalu identik dengan MonthlyFinancialHistory.period
 * dan dengan yang dipakai bot. Satu sumber, bukan dua rumus yang harus dijaga
 * tetap sama.
 */
export function periodeSiklus(acuan: Date, payday: number): Date {
  return getCycleBoundaries(acuan, payday).period;
}

/** Selisih hari menuju jatuh tempo. Negatif berarti sudah lewat. */
export function sisaHari(jatuhTempo: Date, acuan: Date): number {
  const MS_PER_HARI = 24 * 60 * 60 * 1000;
  const a = new Date(jatuhTempo.getFullYear(), jatuhTempo.getMonth(), jatuhTempo.getDate());
  const b = new Date(acuan.getFullYear(), acuan.getMonth(), acuan.getDate());
  return Math.round((a.getTime() - b.getTime()) / MS_PER_HARI);
}
