// src/features/academicCalendar/infrastructure/calendarDownloader.ts
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../../../infrastructure/logger/logger.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Validasi magic bytes file ZIP/XLSX: PK\x03\x04 (0x50 0x4B 0x03 0x04).
 * Ini melindungi staging dari halaman HTML login/preview SharePoint yang mengembalikan HTTP 200.
 */
export function isValidXlsxBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/**
 * Menyusun kandidat URL unduhan langsung dari link sharing OneDrive / SharePoint.
 * Contoh input SharePoint:
 *   https://.../personal/.../_layouts/15/guestaccess.aspx?share=XXX&e=YYY
 * Kandidat yang dicoba secara berurutan:
 *   1. /_layouts/15/download.aspx?share=XXX&e=YYY (endpoint direct download resmi SharePoint)
 *   2. URL asli + &download=1
 *   3. URL asli apa adanya
 */
export function buildDownloadCandidateUrls(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  const candidates: string[] = [];

  try {
    const parsed = new URL(trimmed);
    const isSharePoint = parsed.hostname.toLowerCase().includes("sharepoint.com");
    const isOneDrive = parsed.hostname.toLowerCase().includes("1drv.ms") || parsed.hostname.toLowerCase().includes("onedrive");

    if (isSharePoint && parsed.pathname.toLowerCase().includes("/_layouts/15/guestaccess.aspx")) {
      const directDownloadUrl = new URL(parsed.toString());
      directDownloadUrl.pathname = parsed.pathname.replace(
        /\/_layouts\/15\/guestaccess\.aspx/i,
        "/_layouts/15/download.aspx"
      );
      candidates.push(directDownloadUrl.toString());
    }

    if ((isSharePoint || isOneDrive) && !parsed.searchParams.has("download")) {
      const withDownloadParam = new URL(parsed.toString());
      withDownloadParam.searchParams.set("download", "1");
      candidates.push(withDownloadParam.toString());
    }
  } catch {
    // Jika URL tidak bisa diparse oleh URL constructor, fallback ke string asli
  }

  if (!candidates.includes(trimmed)) {
    candidates.push(trimmed);
  }

  return candidates;
}

export interface DownloadResult {
  stagingFilePath: string;
  downloadedUrl: string;
  byteLength: number;
  downloadedAt: Date;
}

/**
 * Mengunduh file binus-lms-events.xlsx dari ACADEMIC_EXCEL_DOWNLOAD_URL ke folder staging lokal
 * menggunakan penulisan atomic (.tmp -> rename) + validasi magic bytes XLSX.
 */
export async function downloadCalendarExcelToStaging(
  downloadUrl: string,
  stagingFilePath: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<DownloadResult> {
  if (!downloadUrl || !downloadUrl.trim()) {
    throw new Error("ACADEMIC_EXCEL_DOWNLOAD_URL belum dikonfigurasi di environment.");
  }

  await fs.mkdir(path.dirname(stagingFilePath), { recursive: true });

  const candidates = buildDownloadCandidateUrls(downloadUrl);
  const errors: string[] = [];

  for (const url of candidates) {
    try {
      logger.info("[AcademicDownloader] Mencoba mengunduh file Excel kalender...", {
        url: sanitizeUrlForLog(url),
      });

      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KainestCalendarSync/1.0)",
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        errors.push(`HTTP ${response.status} pada ${sanitizeUrlForLog(url)}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!isValidXlsxBuffer(buffer)) {
        const contentType = response.headers.get("content-type") || "unknown";
        errors.push(
          `Respon bukan file XLSX valid (content-type=${contentType}, size=${buffer.length}B) pada ${sanitizeUrlForLog(url)}`
        );
        continue;
      }

      // Atomic write: tulis ke .tmp terlebih dahulu agar reader tidak membaca file setengah jadi
      const tmpPath = `${stagingFilePath}.tmp.${Date.now()}`;
      await fs.writeFile(tmpPath, buffer);
      await fs.rename(tmpPath, stagingFilePath);

      logger.info("[AcademicDownloader] Berhasil mengunduh file Excel ke staging", {
        stagingFilePath,
        byteLength: buffer.length,
      });

      return {
        stagingFilePath,
        downloadedUrl: url,
        byteLength: buffer.length,
        downloadedAt: new Date(),
      };
    } catch (err: any) {
      errors.push(`${err?.message || String(err)} pada ${sanitizeUrlForLog(url)}`);
    }
  }

  throw new Error(
    `Gagal mengunduh file Excel valid dari ACADEMIC_EXCEL_DOWNLOAD_URL. Detail: ${errors.join(" | ")}`
  );
}

function sanitizeUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "[invalid-url]";
  }
}
