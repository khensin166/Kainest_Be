/**
 * src/utils/cycleBoundaries.ts
 *
 * Helper untuk menghitung batas-batas siklus keuangan secara DINAMIS
 * berdasarkan tanggal payday user, bukan kalender bulan standar (tanggal 1).
 *
 * Logika Siklus:
 * - Jika payday = 25 dan hari ini adalah 10 Agustus:
 *   Siklus aktif dimulai 25 Juli dan berakhir 24 Agustus.
 * - Jika hari ini adalah 26 Agustus:
 *   Siklus aktif dimulai 25 Agustus dan berakhir 24 September.
 *
 * Kasus Khusus (Bulan Pendek):
 * - Jika payday = 31 dan bulan tersebut hanya punya 30 hari (April, Juni, dll.),
 *   maka siklus dimulai di hari terakhir bulan tersebut.
 */

/** Mendapatkan hari terakhir dari bulan tertentu (0-indexed month) */
function getLastDay(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Menghitung batas siklus keuangan aktif berdasarkan payday user.
 *
 * @param now    - Waktu referensi (biasanya `new Date()`)
 * @param payday - Tanggal gajian user (1-31). Nilai 31 = akhir bulan.
 * @returns { cycleStart, cycleEnd, prevCycleStart, prevCycleEnd, cycleLabel, prevCycleLabel }
 */
export function getCycleBoundaries(now: Date, payday: number) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  // Hitung tanggal efektif start siklus bulan ini (capping ke hari terakhir jika perlu)
  const effectivePaydayThisMonth = Math.min(payday, getLastDay(year, month));

  // Tentukan apakah siklus saat ini sudah dimulai di bulan ini atau masih di bulan lalu
  let cycleStart: Date;
  let cycleEnd: Date;
  let prevCycleStart: Date;
  let prevCycleEnd: Date;

  if (day >= effectivePaydayThisMonth) {
    // ✅ Sudah melewati payday bulan ini → siklus aktif: bulan ini s/d bulan depan
    cycleStart = new Date(year, month, effectivePaydayThisMonth, 0, 0, 0, 0);

    const nextMonth = month + 1 > 11 ? 0 : month + 1;
    const nextYear = month + 1 > 11 ? year + 1 : year;
    const effectivePaydayNextMonth = Math.min(payday, getLastDay(nextYear, nextMonth));
    cycleEnd = new Date(nextYear, nextMonth, effectivePaydayNextMonth, 0, 0, 0, 0);
    cycleEnd.setMilliseconds(cycleEnd.getMilliseconds() - 1); // Tepat sebelum payday berikutnya

    // Siklus SEBELUMNYA: bulan lalu s/d sehari sebelum cycleStart
    const prevMonth = month - 1 < 0 ? 11 : month - 1;
    const prevYear = month - 1 < 0 ? year - 1 : year;
    const effectivePaydayPrevMonth = Math.min(payday, getLastDay(prevYear, prevMonth));
    prevCycleStart = new Date(prevYear, prevMonth, effectivePaydayPrevMonth, 0, 0, 0, 0);
    prevCycleEnd = new Date(cycleStart.getTime() - 1);
  } else {
    // ⏳ Belum mencapai payday bulan ini → siklus aktif masih dari bulan lalu
    const prevMonth = month - 1 < 0 ? 11 : month - 1;
    const prevYear = month - 1 < 0 ? year - 1 : year;
    const effectivePaydayPrevMonth = Math.min(payday, getLastDay(prevYear, prevMonth));
    cycleStart = new Date(prevYear, prevMonth, effectivePaydayPrevMonth, 0, 0, 0, 0);

    cycleEnd = new Date(year, month, effectivePaydayThisMonth, 0, 0, 0, 0);
    cycleEnd.setMilliseconds(cycleEnd.getMilliseconds() - 1);

    // Siklus SEBELUMNYA: dua bulan lalu s/d sehari sebelum cycleStart
    const prevPrevMonth = prevMonth - 1 < 0 ? 11 : prevMonth - 1;
    const prevPrevYear = prevMonth - 1 < 0 ? prevYear - 1 : prevYear;
    const effectivePaydayPrevPrev = Math.min(payday, getLastDay(prevPrevYear, prevPrevMonth));
    prevCycleStart = new Date(prevPrevYear, prevPrevMonth, effectivePaydayPrevPrev, 0, 0, 0, 0);
    prevCycleEnd = new Date(cycleStart.getTime() - 1);
  }

  // Label untuk pesan-pesan bot (misal: "Juli 2026")
  const MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  // Gunakan cycleEnd untuk pelabelan, karena siklus 30 Juni - 30 Juli dianggap sebagai siklus Juli
  const cycleLabel = `${MONTHS_ID[cycleEnd.getMonth()]} ${cycleEnd.getFullYear()}`;
  const prevCycleLabel = `${MONTHS_ID[prevCycleEnd.getMonth()]} ${prevCycleEnd.getFullYear()}`;

  // Rentang tanggal siklus untuk tampilan bot (misal: "25 Jul - 24 Agu")
  const dateRangeLabel = `${cycleStart.getDate()} ${SHORT_MONTHS[cycleStart.getMonth()]} - ${cycleEnd.getDate()} ${SHORT_MONTHS[cycleEnd.getMonth()]}`;
  const prevDateRangeLabel = `${prevCycleStart.getDate()} ${SHORT_MONTHS[prevCycleStart.getMonth()]} - ${prevCycleEnd.getDate()} ${SHORT_MONTHS[prevCycleEnd.getMonth()]}`;

  // Tentukan 'period' (1st of the month dari cycleEnd) untuk kompatibilitas dengan key MonthlyFinancialHistory
  const period = new Date(Date.UTC(cycleEnd.getFullYear(), cycleEnd.getMonth(), 1));
  const prevPeriod = new Date(Date.UTC(prevCycleEnd.getFullYear(), prevCycleEnd.getMonth(), 1));

  return {
    /** Awal siklus keuangan yang sedang berjalan */
    cycleStart,
    /** Akhir siklus keuangan yang sedang berjalan (inclusive) */
    cycleEnd,
    /** Awal siklus sebelumnya (untuk keperluan !keep, laporan dll.) */
    prevCycleStart,
    /** Akhir siklus sebelumnya (inclusive) */
    prevCycleEnd,
    /** Label siklus aktif dalam bahasa Indonesia */
    cycleLabel,
    /** Label siklus sebelumnya dalam bahasa Indonesia */
    prevCycleLabel,
    /** Rentang tanggal siklus aktif (misal: "25 Jul - 24 Agu") */
    dateRangeLabel,
    /** Rentang tanggal siklus sebelumnya (misal: "25 Jun - 24 Jul") */
    prevDateRangeLabel,
    /** Date (1st of month) untuk primary key MonthlyFinancialHistory siklus aktif */
    period,
    /** Date (1st of month) untuk primary key MonthlyFinancialHistory siklus sebelumnya */
    prevPeriod,
  };
}
