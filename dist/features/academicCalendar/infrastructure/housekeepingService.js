// src/features/academicCalendar/infrastructure/housekeepingService.ts
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../../../infrastructure/logger/logger.js";
const DEFAULT_RETENTION_DAYS = 30;
const MS_PER_DAY = 86400000;
export function getDefaultHousekeepingConfig() {
    const dataDir = process.env.ACADEMIC_DATA_DIR || path.resolve(process.cwd(), "data", "academic");
    const parsedRetention = Number.parseInt(process.env.ACADEMIC_ARCHIVE_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS), 10);
    return {
        dataDir,
        retentionDays: Number.isFinite(parsedRetention) && parsedRetention > 0
            ? parsedRetention
            : DEFAULT_RETENTION_DAYS,
    };
}
/**
 * Format bagian tanggal/waktu untuk folder arsip berdasarkan Asia/Jakarta (WIB).
 */
function getJakartaArchiveParts(now) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value || "00";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    const hour = get("hour");
    const minute = get("minute");
    const second = get("second");
    return {
        yearMonth: `${year}-${month}`,
        stamp: `${year}${month}${day}_${hour}${minute}${second}`,
    };
}
export class HousekeepingService {
    constructor(config = getDefaultHousekeepingConfig()) {
        this.stagingDir = path.join(config.dataDir, "staging");
        this.archiveDir = path.join(config.dataDir, "archive");
        this.retentionDays = config.retentionDays;
    }
    async ensureDirectories() {
        await fs.mkdir(this.stagingDir, { recursive: true });
        await fs.mkdir(this.archiveDir, { recursive: true });
    }
    getStagingFilePath(filename = "binus-lms-events.xlsx") {
        return path.join(this.stagingDir, filename);
    }
    getArchiveRootDir() {
        return this.archiveDir;
    }
    /**
     * Memindahkan file staging yang sudah selesai diproses & di-commit ke DB
     * menuju folder archive/YYYY-MM/<timestamp>_<filename>.
     */
    async archiveStagingFile(stagingFilePath, now = new Date()) {
        const { yearMonth, stamp } = getJakartaArchiveParts(now);
        const targetDir = path.join(this.archiveDir, yearMonth);
        await fs.mkdir(targetDir, { recursive: true });
        const baseName = path.basename(stagingFilePath);
        const targetPath = path.join(targetDir, `${stamp}_${baseName}`);
        try {
            await fs.rename(stagingFilePath, targetPath);
        }
        catch (err) {
            // Fallback jika lintas filesystem (EXDEV)
            if (err?.code === "EXDEV") {
                await fs.copyFile(stagingFilePath, targetPath);
                await fs.unlink(stagingFilePath);
            }
            else {
                throw err;
            }
        }
        logger.info("[AcademicHousekeeping] File staging diarsipkan", {
            from: stagingFilePath,
            to: targetPath,
        });
        return targetPath;
    }
    /**
     * Menghapus file sementara (.tmp.*) yang tertinggal di folder staging bila terjadi crash sebelumnya.
     */
    async cleanupStaleStagingTempFiles(maxAgeMs = 3600000, now = new Date()) {
        await this.ensureDirectories();
        const entries = await fs.readdir(this.stagingDir, { withFileTypes: true });
        let cleaned = 0;
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.includes(".tmp."))
                continue;
            const fullPath = path.join(this.stagingDir, entry.name);
            try {
                const stat = await fs.stat(fullPath);
                if (now.getTime() - stat.mtimeMs > maxAgeMs) {
                    await fs.unlink(fullPath);
                    cleaned++;
                }
            }
            catch {
                // Ignore race condition jika file sudah terhapus
            }
        }
        return cleaned;
    }
    /**
     * Menghapus file arsip yang sudah melewati batas retensi (default > 30 hari)
     * serta membersihkan folder bulan (YYYY-MM) yang kosong.
     */
    async pruneOldArchives(now = new Date()) {
        await this.ensureDirectories();
        const cutoffMs = now.getTime() - this.retentionDays * MS_PER_DAY;
        const deletedFiles = [];
        const monthDirs = await fs.readdir(this.archiveDir, { withFileTypes: true });
        for (const dirEntry of monthDirs) {
            const entryPath = path.join(this.archiveDir, dirEntry.name);
            if (dirEntry.isDirectory()) {
                const files = await fs.readdir(entryPath, { withFileTypes: true });
                for (const fileEntry of files) {
                    if (!fileEntry.isFile())
                        continue;
                    const filePath = path.join(entryPath, fileEntry.name);
                    const stat = await fs.stat(filePath);
                    if (stat.mtimeMs < cutoffMs) {
                        await fs.unlink(filePath);
                        deletedFiles.push(filePath);
                    }
                }
                // Hapus folder YYYY-MM jika sudah kosong
                const remaining = await fs.readdir(entryPath);
                if (remaining.length === 0) {
                    await fs.rmdir(entryPath).catch(() => { });
                }
            }
            else if (dirEntry.isFile()) {
                const stat = await fs.stat(entryPath);
                if (stat.mtimeMs < cutoffMs) {
                    await fs.unlink(entryPath);
                    deletedFiles.push(entryPath);
                }
            }
        }
        if (deletedFiles.length > 0) {
            logger.info("[AcademicHousekeeping] Arsip lama dibersihkan", {
                retentionDays: this.retentionDays,
                deletedCount: deletedFiles.length,
            });
        }
        return {
            deletedCount: deletedFiles.length,
            deletedFiles,
        };
    }
}
