import { botTransactionRepository } from "../../data/BotTransactionRepository.js";
import { classifyTransactionUseCase } from "../../../budgeting/domain/use-cases/ClassifyTransactionUseCase.js";
import { createTransactionUseCase } from "../../../budgeting/domain/use-cases/CreateTransactionUseCase.js";
import { prisma } from "../../../../infrastructure/database/prisma.js";

type ProcessBotTransactionInput = {
  type: string;
  text: string;
  sender: string;
  groupId?: string;
  timestamp?: number;
};

// Pesan sapaan interaktif bot
const HALO_MESSAGE = `Kamu siapanyakkkk? 👀

Kenalan dulu dong! Biar kita bisa mulai catat keuangan bareng, ikutin langkah ini ya:

1️⃣ Buka web *kainest.kenantomfie.site*
2️⃣ Pilih menu *Profile / Settings* di pojok kanan atas.
3️⃣ Pilih tab *Pasangan*, lalu ambil & salin *Kode Undangan* kamu.
4️⃣ Balas pesan ini dengan format:
   \`!link KODE_UNIK_KAMU\`

5️⃣ Jika sudah sukses tertaut, buat grup baru dan masukkan aku (bot) ke dalamnya.
   🤖 *Android*: Di dalam chat ini, ketuk ikon titik tiga (⋮) ➡️ pilih *New Group*.
   🍎 *iPhone*: Ketuk nama profil di atas ➡️ pilih *Create Group with...*

6️⃣ Di grup tersebut, ketik:
   \`!aktifkan-kainest\`
   _(Agar grup tersebut resmi terdaftar sebagai tempat bertransaksi)_

7️⃣ Selesai! Kamu bisa langsung catat pengeluaran 🎉
   Contoh: \`Makan siang 20k\` atau \`Bensin 50rb\``;

export const processBotTransactionUseCase = async (data: ProcessBotTransactionInput) => {
  // 1. Validasi tipe pesan
  if (data.type !== "text" && data.type !== "extendedTextMessage") {
    return { success: false, status: 400, message: "Hanya pesan teks yang didukung" };
  }

  const textMsg = data.text.trim();
  const lowerText = textMsg.toLowerCase();

  // 2. Intercept sapaan "Halo" (tanpa perlu grup aktif / akun tertaut)
  const greetings = ["halo", "hai", "hallo", "hi", "hello", "p", "halo!", "hai!", "hallo!"];
  if (greetings.includes(lowerText)) {
    return {
      success: true,
      data: {
        message: HALO_MESSAGE,
        stickerUrl: "https://cdn2.cdnstep.com/2AMUhE1EYrNGIaXmRrWU/cover-2.thumb256.webp",
      },
    };
  }

  // 3. Pembersihan Sender
  // Contoh sender: 62812345678@s.whatsapp.net atau 172662131298437@lid
  const rawSender = data.sender;
  let cleanSender = rawSender.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@lid", "");

  // 4. Intercept Perintah !link (tanpa perlu grup aktif)
  if (lowerText.startsWith("!link ")) {
    const code = textMsg.split(" ")[1];
    if (!code) {
      return { success: false, status: 400, message: "Format salah. Gunakan: !link KODE_UNIK_KAMU" };
    }

    const userToLink = await botTransactionRepository.getUserByInvitationCode(code);
    if (!userToLink) {
      return { success: false, status: 404, message: "❌ Kode tidak valid atau akun tidak ditemukan. Coba salin ulang kode dari web Kainest ya!" };
    }

    // Simpan raw sender (dengan @lid jika ada) untuk identifikasi akurat
    const jidToSave = rawSender.includes("@lid") ? cleanSender : cleanSender;
    await botTransactionRepository.updateWhatsappJid(userToLink.id, jidToSave);

    return {
      success: true,
      data: {
        message: `✅ Yeay! Akun Kainest *${userToLink.name || userToLink.email}* kini berhasil terhubung! 🎉\n\nSelanjutnya, buat grup baru dan masukkan aku ke sana, lalu ketik *!aktifkan-kainest* di grupnya ya!`,
      },
    };
  }

  // 5. Intercept Perintah !aktifkan-kainest (harus dari grup)
  if (lowerText === "!aktifkan-kainest") {
    if (!data.groupId) {
      return {
        success: false,
        status: 400,
        message: "⚠️ Perintah ini hanya bisa dijalankan di dalam grup ya!",
      };
    }

    await prisma.botActiveGroup.upsert({
      where: { groupId: data.groupId },
      create: { groupId: data.groupId },
      update: {},
    });

    return {
      success: true,
      data: {
        message: "✅ Grup ini berhasil didaftarkan sebagai tempat bertransaksi Kainest! 🎊\n\nSekarang kamu bisa langsung catat pengeluaran di sini.\nContoh: *Makan siang 20k* atau *Bensin 50rb*",
      },
    };
  }

  // 6. Validasi Group (Jika pesan reguler dari grup yang belum aktif)
  if (data.groupId) {
    const activeGroup = await botTransactionRepository.getActiveGroup(data.groupId);
    if (!activeGroup) {
      return {
        success: false,
        status: 403,
        message: "⚠️ Bot belum diaktifkan di grup ini. Ketik *!aktifkan-kainest* terlebih dahulu ya!",
      };
    }
  }

  // 7. Identifikasi User
  const user = await botTransactionRepository.getUserByPhoneNumber(cleanSender);
  if (!user) {
    return {
      success: false,
      status: 404,
      message: `❓ Nomor ini belum terdaftar di Kainest.\n\nKirim *halo* ke chat personal bot untuk melihat cara mendaftarkan diri ya!`,
    };
  }

  // 8. Klasifikasi menggunakan AI
  const classification = await classifyTransactionUseCase(user.id, data.text);

  if (!classification.success || !classification.categoryId) {
    return { success: false, status: 400, message: "Gagal mengklasifikasikan pengeluaran." };
  }

  // 9. Catat Transaksi
  const amount = classification.amount || 0;
  if (amount <= 0) {
    return { success: false, status: 400, message: "Nominal pengeluaran tidak terdeteksi atau 0." };
  }

  const txDate = data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString();

  const createResult = await createTransactionUseCase({
    userId: user.id,
    amount: amount,
    categoryId: classification.categoryId,
    note: classification.note || data.text,
    date: txDate,
  });

  if (!createResult.success) {
    return { success: false, status: 500, message: createResult.message };
  }

  // 10. Kembalikan Response Sukses
  return {
    success: true,
    data: {
      message: `✅ Berhasil dicatat!\n\n📂 Kategori: ${classification.categoryName}\n💰 Nominal: Rp ${amount.toLocaleString("id-ID")}\n📝 Catatan: ${classification.note}`,
      transaction: createResult.data,
    },
  };
};
