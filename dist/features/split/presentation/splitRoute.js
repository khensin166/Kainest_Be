import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { calculateAndSaveSplitController, getSharedSplitController, blastSplitBillController, getSplitHistoryController } from "../services/splitController.js";
export const splitRoute = new Hono();
// 1. Endpoint Publik untuk melihat hasil Split Bill (dibagikan)
splitRoute.get("/share/:id", getSharedSplitController);
// ==========================================
// Middleware Auth (Wajib Login untuk akses endpoint di bawah ini)
// ==========================================
splitRoute.use("*", authMiddleware);
// 2. Menghitung split tagihan lewat AI dan menyimpan ke DB
splitRoute.post("/", calculateAndSaveSplitController);
// 3. Scan Struk (Proxy ke AI Service)
splitRoute.post("/scan", async (c) => {
    const { scanReceiptController } = await import("../services/splitController.js");
    return scanReceiptController(c);
});
// 4. Mengirimkan tagihan via WA Blast (Kainest-GOWA)
splitRoute.post("/blast", blastSplitBillController);
// 5. Riwayat Split Bill
splitRoute.get("/history", getSplitHistoryController);
