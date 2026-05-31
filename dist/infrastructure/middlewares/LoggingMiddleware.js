import * as fs from "fs";
import * as path from "path";
// =========================================
// 🌿 Konfigurasi
// =========================================
const SERVICE_NAME = "kainest-api";
const LOG_DIR = path.join(process.cwd(), "logs");
// Deteksi apakah sedang berjalan di lokal (bukan di Vercel/Production)
const IS_LOCAL = !process.env.VERCEL && process.env.NODE_ENV !== "production";
// Inisialisasi folder logs/ saat server menyala (hanya di lokal)
if (IS_LOCAL) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`[LoggingMiddleware] Mode LOKAL aktif. Log file akan disimpan di: ${LOG_DIR}`);
}
// =========================================
// 🛠️ Helper Functions
// =========================================
/**
 * Menghasilkan nama file log harian berformat:
 * kainest_api_YYYYMMDD.log
 */
const getLogFileName = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return path.join(LOG_DIR, `kainest_api_${year}${month}${day}.log`);
};
/**
 * Format timestamp dengan timezone offset (ISO 8601 + UTC offset lokal)
 * Contoh: "2026-05-31T10:15:23.456+07:00"
 */
const getTimestamp = () => {
    const now = new Date();
    const offset = -now.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const absOffset = Math.abs(offset);
    const hh = String(Math.floor(absOffset / 60)).padStart(2, "0");
    const mm = String(absOffset % 60).padStart(2, "0");
    return now.toISOString().replace("Z", `${sign}${hh}:${mm}`);
};
/**
 * Tulis log ke file harian secara async (non-blocking)
 */
const writeToFile = async (logEntry) => {
    try {
        const filePath = getLogFileName();
        const line = JSON.stringify(logEntry) + "\n";
        await fs.promises.appendFile(filePath, line, "utf8");
    }
    catch (err) {
        // Jangan biarkan kegagalan tulis file menghentikan aplikasi
        console.error("[LoggingMiddleware] Gagal menulis ke file log:", err);
    }
};
// =========================================
// 🚦 Middleware Utama
// =========================================
export const loggingMiddleware = async (c, next) => {
    const startTime = Date.now();
    // Ambil correlation ID dari header (jika ada, misal dari frontend)
    // Jika tidak ada, buat ID unik baru menggunakan bawaan Node.js
    const correlationId = c.req.header("x-correlation-id") ||
        `req-${crypto.randomUUID().slice(0, 8)}`;
    // Simpan correlation ID di context agar bisa dipakai di controller
    c.set("correlationId", correlationId);
    // Tunggu proses route/controller selesai
    await next();
    // Hitung latency
    const latencyMs = Date.now() - startTime;
    const responseCode = c.res.status;
    const level = responseCode >= 500 ? "ERROR" : responseCode >= 400 ? "WARN" : "INFO";
    const status = responseCode >= 400 ? "failed" : "success";
    // Ambil user ID jika ada (dari authMiddleware)
    const userId = c.get("userId") || "anonymous";
    // Buat method + endpoint string: "POST /api/budget/transactions"
    const endpoint = `${c.req.method} ${c.req.path}`;
    const logEntry = {
        timestamp: getTimestamp(),
        level,
        service: SERVICE_NAME,
        event: "http_request",
        correlation_id: correlationId,
        endpoint,
        user_id: userId,
        status,
        response_code: responseCode,
        latency_ms: latencyMs,
        message: status === "success"
            ? "Request processed successfully"
            : `Request failed with status ${responseCode}`,
    };
    // Selalu cetak ke konsol (akan ditangkap oleh Vercel Log Drain / PM2 / Docker logs)
    if (level === "ERROR") {
        console.error(JSON.stringify(logEntry));
    }
    else {
        console.log(JSON.stringify(logEntry));
    }
    // Hanya di lokal: tulis ke file harian secara async
    if (IS_LOCAL) {
        writeToFile(logEntry); // Sengaja tidak di-await agar tidak delay response
    }
};
