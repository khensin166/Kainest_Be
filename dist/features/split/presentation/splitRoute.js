import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { extractClientIp } from "../../../utils/securityHelpers.js";
import { calculateAndSaveSplitController, getSharedSplitController, blastSplitBillController, getSplitHistoryController } from "../services/splitController.js";
export const splitRoute = new Hono();
const splitScanRateLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 15,
    standardHeaders: "draft-6",
    keyGenerator: (c) => c.get("userId") || extractClientIp(c),
});
const splitBlastRateLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-6",
    keyGenerator: (c) => c.get("userId") || extractClientIp(c),
});
// 1. Endpoint Publik untuk melihat hasil Split Bill (dibagikan)
splitRoute.get("/share/:id", getSharedSplitController);
// ==========================================
// Middleware Auth (Wajib Login untuk akses endpoint di bawah ini)
// ==========================================
splitRoute.use("*", authMiddleware);
// 2. Menghitung split tagihan lewat AI dan menyimpan ke DB
splitRoute.post("/", calculateAndSaveSplitController);
// 3. Scan Struk (Proxy ke AI Service)
splitRoute.post("/scan", splitScanRateLimiter, async (c) => {
    const { scanReceiptController } = await import("../services/splitController.js");
    return scanReceiptController(c);
});
// 4. Mengirimkan tagihan via WA Blast (Kainest-GOWA)
splitRoute.post("/blast", splitBlastRateLimiter, blastSplitBillController);
// 5. Riwayat Split Bill
splitRoute.get("/history", getSplitHistoryController);
