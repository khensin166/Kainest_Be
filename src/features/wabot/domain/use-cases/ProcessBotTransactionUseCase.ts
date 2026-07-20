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

  // 5. Deteksi pesan sapaan dasar & kata konfirmasi pendek
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
      // Balas peringatan grup belum aktif
      return {
        success: true, // ubah menjadi true agar text dikirim
        reaction: "⚠️",
        replyText: true,
        data: {
          message: `👋 Halo, ${user.name || "Kak"}! Sebelum mulai mencatat, aktifkan dulu bot di grup ini ya!\n\nKetik:\n  \`!aktifkan-kainest\``,
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

  const replyText = `📒 Siap Noted!!🤖\n\n${randomHeader}\n\n⏰ Waktu: ${formattedTime}\n🔖 Tipe: ${txType}\n💰 Jumlah: ${formattedAmount}\n🧾 Deskripsi: ${description}\n${icon} Pocket: ${pocket}\n\n${randomFooter}`;

  return {
    success: true,
    data: {
      message: replyText,
      transaction: transaction,
    },
  };
};
