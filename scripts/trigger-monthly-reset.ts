// scripts/trigger-monthly-reset.ts
//
// ADMIN TESTING SCRIPT — Trigger Monthly Reset untuk satu user secara MANUAL
//
// Cara pemakaian:
//   npx tsx scripts/trigger-monthly-reset.ts <USER_ID>
//
// Contoh:
//   npx tsx scripts/trigger-monthly-reset.ts qu4k76pZXH5ncDB4GW8R3dUhXVXIZmvB
//
// Script ini mem-bypass jadwal cron (00:10 WIB) dan langsung menjalankan
// processUserReset() secara real-time untuk keperluan testing.

import "dotenv/config";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { processUserReset } from "../src/features/budgeting/services/MonthlyResetCron.js";

const userId = process.argv[2];

if (!userId) {
  console.error("\n❌ ERROR: USER_ID wajib diisi!\n");
  console.error("Penggunaan: npx tsx scripts/trigger-monthly-reset.ts <USER_ID>\n");
  process.exit(1);
}

console.log("\n🚀 [Admin Trigger] Memulai monthly reset untuk user:", userId);
console.log("─".repeat(60));

async function run() {
  try {
    // Ambil user dari database lengkap dengan relasi yang dibutuhkan processUserReset
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        waBotConfig: true,
        botActiveGroups: { select: { groupId: true } },
      },
    });

    if (!user) {
      console.error(`\n❌ User dengan ID "${userId}" tidak ditemukan di database.\n`);
      process.exit(1);
    }

    console.log(`✅ User ditemukan: ${user.name || "(tanpa nama)"} | payday: ${user.payday}`);
    console.log(`   Grup WA aktif: ${user.botActiveGroups.length} grup`);
    console.log("─".repeat(60));

    if (!user.botActiveGroups.length) {
      console.warn("\n⚠️  User tidak memiliki grup WA aktif. Pesan blast TIDAK akan terkirim,");
      console.warn("   tapi logika AI evaluation tetap akan berjalan.\n");
    }

    await processUserReset(user);

    console.log("\n─".repeat(60));
    console.log("✅ [Admin Trigger] Selesai! Cek WhatsApp dan database untuk hasilnya.");
    console.log("─".repeat(60));
  } catch (err: any) {
    console.error("\n❌ Error saat menjalankan trigger:", err.message);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
