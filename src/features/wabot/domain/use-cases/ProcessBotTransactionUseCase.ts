import { botTransactionRepository } from "../../data/BotTransactionRepository.js";
import { classifyTransactionUseCase } from "../../../budgeting/domain/use-cases/ClassifyTransactionUseCase.js";
import { createTransactionUseCase } from "../../../budgeting/domain/use-cases/CreateTransactionUseCase.js";
import { prisma } from "../../../../infrastructure/database/prisma.js";
import { transcribeAudio } from "../../../../infrastructure/api/cloudflareWhisperApi.js";
import { logger } from "../../../../infrastructure/logger/logger.js";

type ProcessBotTransactionInput = {
  type: string;
  text: string;
  audioBuffer?: Buffer;
  sender: string;
  groupId?: string;
  timestamp?: number;
};

// Pesan onboarding untuk user baru yang mengirim pesan pertama kali
const ONBOARDING_MESSAGE = `Kamu siapanyakkkk? 👀

Kenalan dulu yuk! Kamu harus punya akun Kainest dan menautkan nomor WA kamu supaya bisa mencatat bersama kami 🥳

Ikuti langkah ini ya:

1️⃣ *Daftar akun* di web *kainest.kenantomfie.site* (klik Register jika belum punya akun)
2️⃣ Lengkapi data profil kamu (Nama & Nomor HP)
3️⃣ Masuk ke menu *Profile → Pasangan*, lalu salin *Kode Tautan* kamu (formatnya: !link KODE)
4️⃣ Buat *Grup WhatsApp baru* dan masukkan aku (bot) ke dalamnya
5️⃣ Kirim Kode Tautan tersebut *langsung di dalam Grup* yang baru dibuat

Selesai! Akun kamu langsung terhubung dan Grup langsung aktif untuk mencatat pengeluaran 🎉
Contoh mencatat: \`Makan siang 20k\` atau \`Bensin 50rb\``;

export const processBotTransactionUseCase = async (data: ProcessBotTransactionInput) => {
  // 1. Validasi tipe pesan dan transkripsi Audio (Voice Note)
  let textMsg = data.text?.trim() || "";

  if (data.type === "audio" || data.type === "voice" || data.type === "ptt") {
    if (!data.audioBuffer) {
      return { success: false, status: 400, message: "Audio buffer kosong", reaction: "❓" };
    }
    try {
      textMsg = await transcribeAudio(data.audioBuffer);
    } catch (error: any) {
      return { success: false, status: 500, message: error.message, reaction: "⚠️", replyText: true };
    }
  } else if (data.type !== "text" && data.type !== "extendedTextMessage") {
    return { success: false, status: 400, message: "Hanya pesan teks dan pesan suara (VN) yang didukung", reaction: "❓" };
  }

  // Jika teks hasil transkripsi (atau teks asli) kosong
  if (!textMsg) {
    return { success: false, status: 400, message: "Pesan kosong tidak dapat diproses", reaction: "❓" };
  }

  const lowerText = textMsg.toLowerCase();

  // 2. Pembersihan Sender
  const rawSender = data.sender;
  let cleanSender = rawSender.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@lid", "");

  // 3. Intercept Perintah !link (prioritas utama, tanpa perlu cek user/grup)
  if (lowerText.startsWith("!link ")) {
    const code = textMsg.split(" ")[1];
    if (!code) {
      return { success: false, status: 400, message: "Format salah. Gunakan: !link KODE_UNIK_KAMU" };
    }

    const userToLink = await botTransactionRepository.getUserByInvitationCode(code);
    if (!userToLink) {
      return { success: false, status: 404, message: "❌ Kode tidak valid atau akun tidak ditemukan. Coba salin ulang kode dari web Kainest ya!" };
    }

    // Simpan JID pengirim ke database (optional, bisa kosong jika belum ada)
    const jidToSave = rawSender.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@lid", "");
    await botTransactionRepository.updateWhatsappJid(userToLink.id, jidToSave);

    // Jika dikirim dari GRUP: langsung aktifkan grup sekaligus
    if (data.groupId) {
      await prisma.botActiveGroup.upsert({
        where: { groupId: data.groupId },
        create: { groupId: data.groupId },
        update: {},
      });

      return {
        success: true,
        data: {
          message: `✅ Yeay! Akun Kainest *${userToLink.name || userToLink.email}* berhasil terhubung & Grup ini langsung AKTIF! 🎊\n\nKamu sudah bisa langsung mencatat di sini.\nContoh: *Makan siang 20k* atau *Bensin 50rb* 🎉`,
          sendKicawSticker: true,
        },
      };
    }

    // Jika dikirim via PRIVATE CHAT: akun tertaut tapi grup belum
    return {
      success: true,
      data: {
        message: `✅ Akun Kainest *${userToLink.name || userToLink.email}* berhasil terhubung! 🎉\n\nSatu langkah lagi:\n→ Buat *Grup WhatsApp baru*, masukkan aku ke sana, lalu kirim ulang pesan \`!link ${code}\` di dalam grup agar grup tersebut aktif untuk mencatat.`,
        sendKicawSticker: true,
      },
    };
  }

  // 4. Intercept Perintah Bot (berawalan !) — Diproses SETELAH user lookup
  //    Perintah ini memerlukan user valid. Cek user dahulu.
  const isBotCommand = lowerText.startsWith("!") && !lowerText.startsWith("!link");

  if (isBotCommand) {
    const cmdUser = await botTransactionRepository.getUserByPhoneNumber(cleanSender);
    if (!cmdUser) {
      return {
        success: true,
        replyText: true,
        data: { message: `${ONBOARDING_MESSAGE}` },
      };
    }

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const HELP_FOOTER = "\n\n💡 Ketik *!help* untuk bantuan.";

    const formatIDR = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
    const sumExpense = (rows: any[]) => rows.filter(t => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
    const sumIncome = (rows: any[]) => rows.filter(t => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);

    // === !today ===
    if (lowerText === "!today") {
      const txs = await prisma.transaction.findMany({
        where: { userId: cmdUser.id, date: { gte: todayStart } },
        include: { category: true },
        orderBy: { date: "desc" },
      });
      if (!txs.length) return { success: true, replyText: true, data: { message: `📅 Hari ini belum ada transaksi yang tercatat.${HELP_FOOTER}` } };
      const lines = txs.map(t => `${t.category?.icon || "📌"} ${t.category?.name || "-"}: ${t.type === "INCOME" ? "+" : "-"}${formatIDR(t.amount)} — ${t.note || "-"}`).join("\n");
      return { success: true, replyText: true, data: { message: `📅 *Rekap Hari Ini*\n\n${lines}\n\n💰 Total Keluar: ${formatIDR(sumExpense(txs))}\n📈 Total Masuk: ${formatIDR(sumIncome(txs))}${HELP_FOOTER}` } };
    }

    // === !weekly ===
    if (lowerText === "!weekly") {
      const txs = await prisma.transaction.findMany({
        where: { userId: cmdUser.id, date: { gte: weekStart } },
        include: { category: true },
        orderBy: { date: "desc" },
      });
      if (!txs.length) return { success: true, replyText: true, data: { message: `📆 7 hari terakhir belum ada transaksi yang tercatat.${HELP_FOOTER}` } };
      return { success: true, replyText: true, data: { message: `📆 *Rekap 7 Hari Terakhir*\n\n💰 Total Keluar: ${formatIDR(sumExpense(txs))}\n📈 Total Masuk: ${formatIDR(sumIncome(txs))}\n📋 Jumlah Transaksi: ${txs.length}${HELP_FOOTER}` } };
    }

    // === !monthly ===
    if (lowerText === "!monthly") {
      const txs = await prisma.transaction.findMany({
        where: { userId: cmdUser.id, date: { gte: monthStart } },
        include: { category: true },
        orderBy: { date: "desc" },
      });
      if (!txs.length) return { success: true, replyText: true, data: { message: `🗓️ Bulan ini belum ada transaksi yang tercatat.${HELP_FOOTER}` } };
      return { success: true, replyText: true, data: { message: `🗓️ *Rekap Bulan Ini*\n\n💰 Total Keluar: ${formatIDR(sumExpense(txs))}\n📈 Total Masuk: ${formatIDR(sumIncome(txs))}\n📋 Jumlah Transaksi: ${txs.length}${HELP_FOOTER}` } };
    }

    // === !balance / !pockets ===
    if (lowerText === "!balance" || lowerText === "!pockets") {
      // 1. Ambil semua kantong milik user
      const pockets = await prisma.budgetPocket.findMany({
        where: { userId: cmdUser.id },
        include: { category: true },
      });
      if (!pockets.length) return { success: true, replyText: true, data: { message: `💼 Belum ada kantong yang dibuat. Atur kantong di web Kainest dulu ya!${HELP_FOOTER}` } };

      // 2. Ambil gaji bulan ini dari MonthlyFinancialHistory untuk hitung limit (jika pakai persentase)
      const monthlyHistory = await prisma.monthlyFinancialHistory.findFirst({
        where: { userId: cmdUser.id, period: monthStart },
      });
      const salary = monthlyHistory?.salarySnapshot || 0;

      // 3. Ambil total pengeluaran per kategori bulan ini
      const expenses = await prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { userId: cmdUser.id, type: "EXPENSE", date: { gte: monthStart } },
        _sum: { amount: true },
      });
      const expenseMap = Object.fromEntries(expenses.map(e => [e.categoryId, e._sum.amount || 0]));

      // 4. Format laporan
      const lines = pockets.map(p => {
        let limit = 0;
        if (p.limitAmount && p.limitAmount > 0) limit = p.limitAmount;
        else if (p.percentage && p.percentage > 0) limit = Math.floor((p.percentage / 100) * salary);
        
        const spent = expenseMap[p.categoryId] || 0;
        const sisa = limit - spent;
        return `${p.category?.icon || "📌"} *${p.category?.name || "-"}*: Sisa ${formatIDR(sisa > 0 ? sisa : 0)} dari ${formatIDR(limit)}`;
      }).join("\n");
      
      return { success: true, replyText: true, data: { message: `💼 *Saldo Kantong Bulan Ini*\n\n${lines}${HELP_FOOTER}` } };
    }

    // === !top ===
    if (lowerText === "!top") {
      const txs = await prisma.transaction.findMany({
        where: { userId: cmdUser.id, type: "EXPENSE", date: { gte: monthStart } },
        include: { category: true },
        orderBy: { amount: "desc" },
        take: 3,
      });
      if (!txs.length) return { success: true, replyText: true, data: { message: `🏆 Belum ada pengeluaran bulan ini.${HELP_FOOTER}` } };
      const lines = txs.map((t, i) => `${i + 1}. ${t.category?.icon || "📌"} ${t.category?.name || "-"}: ${formatIDR(t.amount)} — ${t.note || "-"}`).join("\n");
      return { success: true, replyText: true, data: { message: `🏆 *Top 3 Pengeluaran Terbesar Bulan Ini*\n\n${lines}${HELP_FOOTER}` } };
    }

    // === !recent ===
    if (lowerText === "!recent") {
      const txs = await prisma.transaction.findMany({
        where: { userId: cmdUser.id },
        include: { category: true },
        orderBy: { date: "desc" },
        take: 5,
      });
      if (!txs.length) return { success: true, replyText: true, data: { message: `📜 Belum ada transaksi yang tercatat.${HELP_FOOTER}` } };
      const lines = txs.map(t => `${t.category?.icon || "📌"} ${t.category?.name || "-"}: ${t.type === "INCOME" ? "+" : "-"}${formatIDR(t.amount)} — ${t.note || "-"}`).join("\n");
      return { success: true, replyText: true, data: { message: `📜 *5 Transaksi Terakhir*\n\n${lines}${HELP_FOOTER}` } };
    }

    // === !undo ===
    if (lowerText === "!undo") {
      // Tampilkan transaksi terakhir dan minta konfirmasi
      const lastTx = await prisma.transaction.findFirst({
        where: { userId: cmdUser.id },
        include: { category: true },
        orderBy: { date: "desc" },
      });
      if (!lastTx) return { success: true, replyText: true, data: { message: `❌ Tidak ada transaksi yang bisa dibatalkan.${HELP_FOOTER}` } };
      const formattedAmt = formatIDR(lastTx.amount);
      return {
        success: true, replyText: true,
        data: { message: `⚠️ *Konfirmasi Hapus Transaksi Terakhir*\n\n${lastTx.category?.icon || "📌"} ${lastTx.category?.name || "-"}: ${formattedAmt}\n🧾 ${lastTx.note || "-"}\n\nKetik *!undo Y* untuk menghapus transaksi ini.${HELP_FOOTER}` }
      };
    }

    // === !undo Y (konfirmasi) ===
    if (lowerText === "!undo y") {
      const lastTx = await prisma.transaction.findFirst({
        where: { userId: cmdUser.id },
        orderBy: { date: "desc" },
      });
      if (!lastTx) return { success: true, replyText: true, data: { message: `❌ Tidak ada transaksi yang bisa dihapus.${HELP_FOOTER}` } };
      await prisma.transaction.delete({ where: { id: lastTx.id } });
      return { success: true, replyText: true, data: { message: `✅ Transaksi berhasil dihapus!\n🧾 ${lastTx.note || "-"} (${formatIDR(lastTx.amount)})${HELP_FOOTER}` } };
    }

    // === !help ===
    if (lowerText === "!help") {
      return {
        success: true, replyText: true,
        data: {
          message: `🤖 *Kainest Bot — Daftar Perintah*\n\n` +
            `📋 *Laporan*\n` +
            `!today   — Rekap pengeluaran hari ini\n` +
            `!weekly  — Rekap 7 hari terakhir\n` +
            `!monthly — Rekap bulan berjalan\n` +
            `!balance — Sisa saldo tiap kantong\n` +
            `!top     — Top 3 pengeluaran terbesar bulan ini\n` +
            `!recent  — 5 transaksi terakhir\n\n` +
            `⚙️ *Aksi*\n` +
            `!undo    — Lihat & konfirmasi hapus transaksi terakhir\n` +
            `!undo Y  — Hapus transaksi terakhir (setelah konfirmasi)\n` +
            `!link KODE — Hubungkan akun & aktifkan grup\n\n` +
            `💬 *Mencatat Transaksi*\n` +
            `Cukup ketik transaksimu secara natural, contoh:\n` +
            `_Makan siang 25k_ atau _Gajian 3.5jt_`
        }
      };
    }

    // Perintah tidak dikenal
    return {
      success: true, replyText: true,
      data: { message: `❓ Perintah tidak dikenali. Ketik *!help* untuk melihat daftar perintah yang tersedia.` }
    };
  }

  const isGreeting = ["hai", "halo", "hallo", "hello", "p", "ping"].includes(lowerText.trim());
  const isAck = ["ok", "oke", "sip", "siap", "mantap", "makasih", "terima kasih", "thanks", "y", "ya", "iya", "yaps"].includes(lowerText.trim());

  // 6. Cek apakah pengirim sudah terdaftar di Kainest
  const user = await botTransactionRepository.getUserByPhoneNumber(cleanSender);

  if (!user) {
    // Jika dari grup atau personal, kirim ONBOARDING dengan reaction ⚠️
    const groupNotice = data.groupId ? "\n\n_Oh ya, grup ini juga belum terdaftar untuk Kainest loh._" : "";
    return {
      success: true, // true agar dikirim pesannya
      reaction: "⚠️",
      replyText: true,
      data: {
        message: `${ONBOARDING_MESSAGE}${groupNotice}`,
        sendKicawSticker: true,
      },
    };
  }

  // 7. Validasi Grup Aktif (user sudah terdaftar, tapi grup belum diaktifkan)
  if (data.groupId) {
    const activeGroup = await botTransactionRepository.getActiveGroup(data.groupId);
    if (!activeGroup) {
      // Balas peringatan grup belum aktif — arahkan ke !link
      return {
        success: true,
        reaction: "⚠️",
        replyText: true,
        data: {
          message: `👋 Halo, ${user.name || "Kak"}! Grup ini belum terdaftar untuk Kainest.\n\nUntuk mengaktifkannya, kirim perintah berikut di grup ini:\n  \`!link KODE_TAUTANMU\`\n\n_(Temukan kodemu di web Kainest → Profil → Pasangan)_\n\n💡 Ketik !help untuk bantuan.`,
        }
      };
    }
  }


  // 8. Jika sapaan dan grup sudah aktif → balas sambutan singkat
  if (isGreeting) {
    return {
      success: true,
      reaction: "👀",
      replyText: true, // tetap balas teks
      data: {
        message: `Halo, ${user.name || "Kak"}! 👋 Siap mencatat keuanganmu hari ini!\n\nLangsung ketik transaksimu ya, contoh:\n*Makan siang 20k* atau *Bensin 50rb* 😊`,
      },
    };
  }

  // 9. Jika pesan hanya kata konfirmasi singkat ("ok", "sip"), abaikan saja tapi beri reaksi
  if (isAck) {
    // success false tapi dengan reaction 👀 agar dikirim reaksi saja tanpa text
    return { success: false, status: 200, isIgnored: false, ignoreReason: "acknowledgment_word", reaction: "👀", message: "" };
  }

  // 10. Klasifikasi menggunakan AI
  const classification = await classifyTransactionUseCase(user.id, data.text);

  if (!classification.success || !classification.categoryId) {
    return { success: false, status: 400, message: "Gagal mengklasifikasikan pengeluaran.", reaction: "❓" };
  }

  // 9. Catat Transaksi
  const amount = classification.amount || 0;
  if (amount <= 0) {
    return { success: false, status: 400, message: "Nominal pengeluaran tidak terdeteksi atau 0.", reaction: "❓" };
  }

  const txDate = data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString();

  const createResult = await createTransactionUseCase({
    userId: user.id,
    amount: amount,
    categoryId: classification.categoryId,
    note: classification.note || data.text,
    date: txDate,
    type: classification.type, // ✅ Teruskan tipe INCOME/EXPENSE dari hasil klasifikasi AI
  });

  if (!createResult.success) {
    return { success: false, status: 500, message: createResult.message };
  }

  // 10. Kembalikan Response Sukses
  const transaction = createResult.data;
  const pocket = transaction.category?.name || classification.categoryName || "-";
  const icon = transaction.category?.icon || "🎯";
  const formattedAmount = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
  }).format(amount);

  const dateObj = new Date(txDate);
  const day = dateObj.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric" });
  const month = dateObj.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", month: "long" });
  const year = dateObj.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", year: "numeric" });
  const time = dateObj.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).replace('.', ':').replace(':', '.');
  const formattedTime = `${day} ${month} ${year} pukul ${time}`;

  const txType = transaction.type === "INCOME" ? "Pemasukan" : "Pengeluaran";
  const description = transaction.note || "-";

  const headerTexts = [
      "Transaksi berhasil diamankan ke database, bosku 😎",
      "Dompet baru saja berbisik: \"noted...\" 😭",
      "Ada transaksi baru nih 👀",
      "Transaksi berhasil dikenali dan dicatat otomatis.",
      "Kainest sudah catat biar nggak hilang dari ingatan 😆"
  ];

  let footerTexts = [];
  if (transaction.type === "INCOME") {
      footerTexts = [
          "Alhamdulillah saldo mengembang 🤩",
          "Makin tebel aja nih dompet 💸",
          "Catatan aman, nikmati hasil jerih payahmu 🫡",
          "Kainest ikut seneng denger kabarnya 🎉"
      ];
  } else {
      footerTexts = [
          "Saldo mungkin menangis, tapi catatan tetap rapi 🫡",
          "Misi budgeting hari ini lanjut jalan 🚀",
          "Tenang, Kainest sudah pegang datanya 🤝",
          "Catatan aman, tinggal mental yang harus kuat 🫠"
      ];
  }

  const randomHeader = headerTexts[Math.floor(Math.random() * headerTexts.length)];
  const randomFooter = footerTexts[Math.floor(Math.random() * footerTexts.length)];

  const replyText = `📒 Siap Noted!!🤖\n\n${randomHeader}\n\n⏰ Waktu: ${formattedTime}\n🔖 Tipe: ${txType}\n💰 Jumlah: ${formattedAmount}\n🧾 Deskripsi: ${description}\n${icon} Pocket: ${pocket}\n\n${randomFooter}\n\n💡 Ketik *!help* untuk bantuan.`;

  return {
    success: true,
    data: {
      message: replyText,
      transaction: transaction,
    },
  };
};
