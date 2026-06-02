import { botTransactionRepository } from "../../data/BotTransactionRepository.js";
import { classifyTransactionUseCase } from "../../../budgeting/domain/use-cases/ClassifyTransactionUseCase.js";
import { createTransactionUseCase } from "../../../budgeting/domain/use-cases/CreateTransactionUseCase.js";

type ProcessBotTransactionInput = {
  type: string;
  text: string;
  sender: string;
  groupId?: string;
  timestamp?: number;
};

export const processBotTransactionUseCase = async (data: ProcessBotTransactionInput) => {
  // 1. Validasi tipe pesan
  if (data.type !== "text" && data.type !== "extendedTextMessage") {
    return { success: false, status: 400, message: "Hanya pesan teks yang didukung" };
  }

  // 2. Validasi Group (Jika pesan dari grup)
  if (data.groupId) {
    const activeGroup = await botTransactionRepository.getActiveGroup(data.groupId);
    if (!activeGroup) {
      return { success: false, status: 403, message: "Bot tidak diaktifkan untuk grup ini" };
    }
  }

  // 3. Pembersihan Sender
  // Contoh sender: 62812345678@s.whatsapp.net atau 172662131298437@lid
  let cleanSender = data.sender.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@lid", "");

  // 3.5 Intercept Perintah !link
  const textMsg = data.text.trim();
  if (textMsg.startsWith("!link ")) {
    const code = textMsg.split(" ")[1];
    if (!code) {
      return { success: false, status: 400, message: "Kode undangan tidak valid." };
    }
    
    const userToLink = await botTransactionRepository.getUserByInvitationCode(code);
    if (!userToLink) {
      return { success: false, status: 404, message: "Kode tidak valid atau akun tidak ditemukan." };
    }

    // Update whatsappJid
    await botTransactionRepository.updateWhatsappJid(userToLink.id, cleanSender);
    
    return {
      success: true,
      data: {
        message: "✅ Berhasil! Akun Kainest Anda kini terhubung. Anda sekarang bisa mulai mencatat pengeluaran dari WhatsApp."
      }
    };
  }

  // 4. Identifikasi User
  const user = await botTransactionRepository.getUserByPhoneNumber(cleanSender);
  if (!user) {
    return { 
      success: false, 
      status: 404, 
      message: `Nomor belum terdaftar di Kainest: ${cleanSender}` 
    };
  }

  // 5. Klasifikasi menggunakan AI (Hybrid Routing siap di sini jika ingin ditambahkan regex manual ke depannya)
  const classification = await classifyTransactionUseCase(user.id, data.text);

  if (!classification.success || !classification.categoryId) {
    return { success: false, status: 400, message: "Gagal mengklasifikasikan pengeluaran." };
  }

  // 6. Catat Transaksi
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

  // 7. Kembalikan Response Sukses
  return {
    success: true,
    data: {
      message: `Berhasil dicatat!\n\nKategori: ${classification.categoryName}\nNominal: Rp ${amount.toLocaleString("id-ID")}\nCatatan: ${classification.note}`,
      transaction: createResult.data
    }
  };
};
