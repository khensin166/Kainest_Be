// src/features/budgeting/services/MonthlyResetCron.ts
// Layanan cron job untuk reset siklus keuangan bulanan & blast pesan ringkasan.
//
// Logika inti:
// - Berjalan setiap hari pukul 00:10 (tengah malam lewat 10 menit, Asia/Jakarta)
// - Mendeteksi user yang payday-nya jatuh pada hari ini
// - Menghitung ringkasan keuangan siklus yang baru saja berakhir
// - Meminta Groq AI untuk menyusun analisis & saran singkat
// - Blast pesan ringkasan tersebut ke grup WA aktif user via GOWA
//
// ⚠️  GUARD: Hanya aktif jika ENABLE_SCHEDULER=true (HANYA set di .env VPS Production)
//     Ini mencegah double-blast dari node Vercel yang juga menjalankan backend.

import * as schedule from "node-schedule";
import { prisma } from "../../../infrastructure/database/prisma.js";
import { groqService } from "../../../infrastructure/ai/groqService.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { getCycleBoundaries } from "../../../utils/cycleBoundaries.js";

// ── Env config ───────────────────────────────────────────────────────────────
const GOWA_BASE_URL = process.env.GOWA_BASE_URL || "http://gowa:3000";
const GOWA_API_KEY = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || "";
const GOWA_DEVICE_ID = process.env.WA_BOT_DEVICE_ID || process.env.GOWA_DEVICE_ID || "";
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === "true";

// ── Helper: Format mata uang Indonesia ───────────────────────────────────────
const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

// ── Helper: Format nama bulan Indonesia ───────────────────────────────────────
function formatMonthIndonesian(date: Date): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ── Helper: Kirim pesan teks via GOWA ────────────────────────────────────────
async function sendTextViaGowa(phone: string, message: string): Promise<void> {
  const url = `${GOWA_BASE_URL}/send/message`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": GOWA_DEVICE_ID,
        ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
      },
      body: JSON.stringify({ phone, message }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`GOWA send failed [${resp.status}]: ${text}`);
    }
    logger.info("[MonthlyReset] Blast pesan terkirim", { phone });
  } catch (err: any) {
    logger.error("[MonthlyReset] Gagal kirim blast via GOWA", { phone, error: err.message });
  }
}

// ── Helper: Dapatkan hari terakhir di bulan tertentu ─────────────────────────
function getLastDayOfMonth(year: number, month: number): number {
  // month di sini adalah 0-indexed (Jan=0, Feb=1, dst.)
  return new Date(year, month + 1, 0).getDate();
}

// ── Core: Deteksi apakah hari ini adalah hari reset untuk user tertentu ───────
function isTodayResetDay(payday: number): boolean {
  const now = new Date();
  // Kita ingin reset berjalan 1 hari SETELAH payday efektif.
  // Cari tahu tanggal "kemarin", lalu cek apakah kemarin adalah payday efektif.
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yYear = yesterday.getFullYear();
  const yMonth = yesterday.getMonth();
  const yDate = yesterday.getDate();

  const lastDayOfYesterdayMonth = getLastDayOfMonth(yYear, yMonth);
  const effectivePayday = Math.min(payday, lastDayOfYesterdayMonth);

  return yDate === effectivePayday;
}

// ── Core: Kalkulasi ringkasan keuangan siklus yang berakhir ─────────────────
async function calculateCycleSummary(userId: string, payday: number): Promise<{
  salary: number;
  totalExpense: number;
  totalIncome: number;
  surplus: number;
  pocketsDetail: string;
  periodLabel: string;
}> {
  const now = new Date();
  // "Kemarin" = hari payday yang baru saja terlewati (misal: 31 Juli).
  // Cron ini dijalankan 1 hari setelah payday (misal: 1 Agustus).
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  
  // Dari sudut pandang "kemarin" (= hari payday), siklus yang aktif ADALAH siklus yang baru saja selesai.
  // Kita ambil 'prevPeriod' karena:
  //   - getCycleBoundaries(kemarin=31 Juli, payday=31) akan mendeteksi bahwa kemarin >= payday,
  //     sehingga 'period' = siklus baru (1 Agustus), BUKAN siklus yang baru selesai.
  //   - Siklus yang baru selesai ada di 'prevPeriod' (1 Juli) dan labelnya di 'prevCycleLabel'.
  const cycle = getCycleBoundaries(yesterday, payday);

  const history = await prisma.monthlyFinancialHistory.findFirst({
    where: {
      userId,
      period: cycle.prevPeriod, // ← Siklus yang BARU SAJA SELESAI, bukan siklus baru
    },
  });

  const salary = history?.salarySnapshot || 0;
  const totalExpense = history?.totalSpent || 0;
  const totalIncome = (history?.totalIncome || 0) + salary;
  const surplus = totalIncome - totalExpense;
  const periodLabel = cycle.prevCycleLabel; // ← Label siklus yang baru selesai (misal: "Juli 2026")

  // Format ringkasan per kantong dari snapshot JSON
  let pocketsDetail = "";
  if (history?.pocketsSnapshot && Array.isArray(history.pocketsSnapshot)) {
    pocketsDetail = (history.pocketsSnapshot as any[])
      .map((p: any) => {
        const pct = p.limitAmount > 0 ? Math.round((p.spent / p.limitAmount) * 100) : 0;
        const bar = pct >= 100 ? "🔴" : pct >= 75 ? "🟡" : "🟢";
        return `${bar} ${p.icon || "💰"} ${p.categoryName}: ${formatIDR(p.spent)} / ${formatIDR(p.limitAmount)} (${pct}%)`;
      })
      .join("\n");
  }

  return { salary, totalExpense, totalIncome, surplus, pocketsDetail, periodLabel };
}

// ── Core: Generate AI insight untuk ringkasan ───────────────────────────────
async function generateAiInsight(summary: {
  salary: number;
  totalExpense: number;
  surplus: number;
  periodLabel: string;
}, userId: string): Promise<string> {
  const systemPrompt = `Kamu adalah Kenin, asisten keuangan pribadi yang bersahabat dan bijak. 
Tugas kamu: Berikan ringkasan singkat (maksimal 3 kalimat) dan saran finansial yang actionable 
berdasarkan data keuangan pengguna bulan lalu. 
Gunakan bahasa Indonesia yang santai, hangat, dan menyemangati.
JANGAN menyebut nama bulan dalam kalimat karena sudah ada di header pesan.`;

  const userContext = JSON.stringify({
    gaji: summary.salary,
    total_pengeluaran: summary.totalExpense,
    sisa_uang: summary.surplus,
    rasio_pengeluaran: summary.salary > 0 ? `${Math.round((summary.totalExpense / summary.salary) * 100)}%` : "N/A",
  });

  try {
    const insight = await groqService.generateResponse(systemPrompt, userContext, {
      userId,
      feature: "monthly_reset_insight",
    });
    return insight;
  } catch {
    return "Pertahankan kebiasaan baikmu! Konsistensi adalah kunci menuju keuangan yang sehat. 💪";
  }
}

// ── Core: Proses reset & blast untuk satu user ───────────────────────────────
export async function processUserReset(user: {
  id: string;
  name: string | null;
  payday: number | null;
  waBotConfig: { baseUrl: string } | null;
  botActiveGroups: { groupId: string }[];
}): Promise<void> {
  logger.info(`[MonthlyReset] Memproses reset untuk user: ${user.name || user.id}`);

  const payday = user.payday ?? 31;
  const summary = await calculateCycleSummary(user.id, payday);
  const aiInsight = await generateAiInsight(summary, user.id);

  // Susun pesan blast
  const surplusLine =
    summary.surplus > 0
      ? `💰 *Sisa Saldo:* ${formatIDR(summary.surplus)} ✨\n\n_(Ketik *!keep* jika mau sisa ini ditambahkan ke bulan depan)_`
      : summary.surplus < 0
      ? `⚠️ *Defisit:* ${formatIDR(Math.abs(summary.surplus))}\n_(Pengeluaran melebihi pemasukan. Yuk lebih hati-hati!)_`
      : `⚖️ *Saldo pas-pasan.* Tidak lebih, tidak kurang.`;

  const blastMessage = `📊 *LAPORAN AKHIR SIKLUS — ${summary.periodLabel.toUpperCase()}*
untuk ${user.name || "Pengguna Kainest"} 👋
━━━━━━━━━━━━━━━━━━━━
💵 *Gaji/Pemasukan:* ${formatIDR(summary.totalIncome)}
🛒 *Total Pengeluaran:* ${formatIDR(summary.totalExpense)}
${surplusLine}

📦 *Rincian Kantong:*
${summary.pocketsDetail || "_(Tidak ada data kantong)_"}

🤖 *Kata Kenin AI:*
${aiInsight}
━━━━━━━━━━━━━━━━━━━━
💡 Ketik *!help* untuk bantuan.`;

  // Kirim ke semua grup aktif user
  if (!user.botActiveGroups.length) {
    logger.warn(`[MonthlyReset] User ${user.id} tidak memiliki grup aktif, blast dilewati.`);
    return;
  }

  for (const group of user.botActiveGroups) {
    await sendTextViaGowa(group.groupId, blastMessage);
    // Jeda antar grup agar tidak dianggap spam
    await new Promise((r) => setTimeout(r, 2000));
  }

  logger.info(`[MonthlyReset] ✅ Blast selesai untuk ${user.name || user.id}`);
}

// ── Core: Jalankan reset untuk semua user yang payday-nya hari ini ────────────
async function runMonthlyReset(): Promise<void> {
  logger.info("[MonthlyReset] 🌙 Memulai pengecekan siklus reset tengah malam...");

  try {
    // Ambil semua user beserta grup WA aktif mereka
    const users = await prisma.user.findMany({
      where: { salary: { gt: 0 } }, // Hanya user yang sudah setup gaji
      include: {
        waBotConfig: true,
        botActiveGroups: { select: { groupId: true } },
      },
    });

    let processedCount = 0;

    for (const user of users) {
      // Lewati user tanpa grup WA aktif
      if (!user.botActiveGroups.length) continue;
      // Cek apakah hari ini adalah hari reset user ini
      const payday = user.payday ?? 31;
      if (!isTodayResetDay(payday)) continue;

      await processUserReset(user);
      processedCount++;

      // Jeda antar user untuk menghindari rate limit GOWA
      await new Promise((r) => setTimeout(r, 3000));
    }

    logger.info(`[MonthlyReset] ✅ Selesai. ${processedCount} user diproses.`);
  } catch (err: any) {
    logger.error("[MonthlyReset] ❌ Error saat menjalankan monthly reset", { error: err.message });
  }
}

// ── Fungsi Utama: Daftarkan cron job ─────────────────────────────────────────
export function startMonthlyResetScheduler(): void {
  // Guard: Hanya aktif jika ENABLE_SCHEDULER=true (VPS Production saja)
  // Ini mencegah double-blast dari node Vercel yang juga menjalankan backend.
  if (!ENABLE_SCHEDULER) {
    logger.info(
      "[MonthlyReset] ENABLE_SCHEDULER tidak aktif. Monthly Reset Cron tidak dijalankan (non-production / Vercel)."
    );
    return;
  }

  logger.info("[MonthlyReset] ✅ Mendaftarkan Monthly Reset Cron Job (00:10 WIB setiap hari)...");

  // Cron: Setiap hari pukul 00:10 WIB
  schedule.scheduleJob({ hour: 0, minute: 10, tz: "Asia/Jakarta" }, () => {
    logger.info("[MonthlyReset] ⏰ Cron triggered: Menjalankan monthly reset...");
    runMonthlyReset();
  });

  logger.info("[MonthlyReset] → Cron job terdaftar: setiap hari pukul 00:10 WIB.");
}
