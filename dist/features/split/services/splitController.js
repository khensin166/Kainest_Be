import { SplitBillSessionRepository } from "../domain/SplitBillSessionRepository.js";
import { auth } from "../../../infrastructure/auth.js";
import { sendGroupMessageViaGowa } from "../../wabot/services/BlastController.js";
const RECEIPT_AI_URL = process.env.RECEIPT_AI_URL || "https://receipt-ai.kenantomfie.com";
const RECEIPT_AI_TOKEN = process.env.RECEIPT_AI_TOKEN || "dev_token_123";
/**
 * Menerima payload split bill dari frontend, mengirimnya ke AI Service (FastAPI),
 * lalu menyimpan hasilnya di Database (Prisma) agar bisa dibagikan publik.
 */
export const calculateAndSaveSplitController = async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session || !session.user) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        const payload = await c.req.json();
        // 1. Kirim request ke Receipt AI Service (Python)
        const response = await fetch(`${RECEIPT_AI_URL}/receipt/split`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": RECEIPT_AI_TOKEN,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return c.json({ error: "Gagal menghitung di AI Service", details: errorData }, response.status);
        }
        const aiResult = await response.json();
        const data = aiResult.data;
        // 2. Simpan hasil ke Database untuk public sharing
        const savedSession = await SplitBillSessionRepository.createSession({
            userId: session.user.id,
            merchant: payload.merchant,
            totalAmount: data.total_amount,
            splitData: data.breakdown,
            summaryText: data.summary_text,
        });
        return c.json({
            status: "success",
            sessionId: savedSession.id,
            data: data,
        });
    }
    catch (error) {
        console.error("[SplitController] Error calculateAndSave:", error);
        return c.json({ error: "Internal Server Error" }, 500);
    }
};
/**
 * Proxy upload struk dari Frontend ke AI Service untuk di-scan (OCR).
 */
export const scanReceiptController = async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session || !session.user) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        const formData = await c.req.formData();
        // Receipt AI Service (FastAPI) membutuhkan field bernama 'image'
        if (formData.has("file") && !formData.has("image")) {
            const file = formData.get("file");
            if (file) {
                formData.append("image", file);
            }
        }
        // Kirim formData (termasuk file) ke AI Service
        const response = await fetch(`${RECEIPT_AI_URL}/receipt/scan`, {
            method: "POST",
            headers: {
                "X-API-Key": RECEIPT_AI_TOKEN,
            },
            body: formData,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return c.json({ error: "Gagal scan struk di AI Service", details: errorData }, response.status);
        }
        const aiResult = await response.json();
        return c.json(aiResult);
    }
    catch (error) {
        console.error("[SplitController] Error scanReceipt:", error);
        return c.json({ error: "Internal Server Error" }, 500);
    }
};
/**
 * Mengambil data Split Bill berdasarkan ID untuk halaman Share publik.
 */
export const getSharedSplitController = async (c) => {
    try {
        const id = c.req.param("id");
        const session = await SplitBillSessionRepository.getSessionById(id);
        if (!session || !session.isPublic) {
            return c.json({ error: "Catatan tidak ditemukan atau privat" }, 404);
        }
        return c.json({ status: "success", data: session });
    }
    catch (error) {
        console.error("[SplitController] Error getSharedSplit:", error);
        return c.json({ error: "Internal Server Error" }, 500);
    }
};
/**
 * Blast pesan Split Bill via WA Bot (Kainest-GOWA)
 */
export const blastSplitBillController = async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session || !session.user) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        const { targetPhone, message } = await c.req.json();
        if (!targetPhone || !message) {
            return c.json({ error: "Target dan pesan harus diisi" }, 400);
        }
        // Mengirim WA menggunakan fungsi bawaan GOWA dari BlastController
        await sendGroupMessageViaGowa(targetPhone, message);
        return c.json({ status: "success", message: "Blast dikirim!" });
    }
    catch (error) {
        console.error("[SplitController] Error blast WA:", error);
        return c.json({ error: "Gagal mengirim WhatsApp", details: error.message }, 500);
    }
};
/**
 * Mengambil riwayat Split Bill pengguna yang sedang login.
 */
export const getSplitHistoryController = async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session || !session.user) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        const history = await SplitBillSessionRepository.getSessionsByUserId(session.user.id);
        return c.json({ status: "success", data: history });
    }
    catch (error) {
        console.error("[SplitController] Error getSplitHistory:", error);
        return c.json({ error: "Internal Server Error" }, 500);
    }
};
