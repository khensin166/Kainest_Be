// src/features/academicCalendar/infrastructure/excelCalendarReader.ts
import * as crypto from "crypto";
import * as fs from "fs";
import ExcelJS from "exceljs";
import type { RawExcelEventRow } from "../domain/types.js";
import { extractCellText } from "../domain/calendarNormalizer.js";

const EXPECTED_TABLE_NAME = "EventsTable";

const HEADER_ALIASES: Record<keyof Omit<RawExcelEventRow, "rowNumber">, string[]> = {
  EventId: ["eventid", "event_id", "id"],
  Subject: ["subject", "title"],
  StartUtc: ["startutc", "start_utc", "start"],
  EndUtc: ["endutc", "end_utc", "end"],
  LastModifiedUtc: ["lastmodifiedutc", "last_modified_utc", "lastmodified"],
  BodyHtml: ["bodyhtml", "body_html", "body"],
  WebLink: ["weblink", "web_link", "link"],
};

/**
 * Menghitung SHA-256 checksum file secara streaming agar hemat memori.
 */
export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function resolveHeaderKey(rawHeader: string): keyof Omit<RawExcelEventRow, "rowNumber"> | null {
  const normalized = rawHeader.toLowerCase().replace(/[\s_-]+/g, "");
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((alias) => alias.replace(/[\s_-]+/g, "") === normalized)) {
      return canonical as keyof Omit<RawExcelEventRow, "rowNumber">;
    }
  }
  return null;
}

/**
 * Konversi referensi kolom Excel (mis. "A" -> 1, "G" -> 7, "AA" -> 27).
 */
function excelColToNumber(colLetters: string): number {
  let num = 0;
  for (let i = 0; i < colLetters.length; i++) {
    num = num * 26 + (colLetters.toUpperCase().charCodeAt(i) - 64);
  }
  return num;
}

/**
 * Parse cell ref Excel seperti "A1" -> { col: 1, row: 1 }.
 */
function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
  if (!match) return null;
  return {
    col: excelColToNumber(match[1]),
    row: Number.parseInt(match[2], 10),
  };
}

/**
 * Membaca tabel `EventsTable` dari file Excel (.xlsx) menggunakan ExcelJS.
 * Jika tabel bernama `EventsTable` tidak ditemukan (mis. export ulang tanpa Excel Table),
 * otomatis fallback ke sheet pertama dengan pencocokan nama kolom header secara case-insensitive.
 */
export async function readEventsTableFromExcel(filePath: string): Promise<RawExcelEventRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  if (!workbook.worksheets.length) {
    throw new Error("File Excel tidak memiliki worksheet.");
  }

  // 1. Prioritas utama: cari Excel Table bernama 'EventsTable' di semua worksheet
  for (const worksheet of workbook.worksheets) {
    const tablesMap = (worksheet as any).tables as Record<string, any> | undefined;
    if (!tablesMap) continue;

    const matchedKey = Object.keys(tablesMap).find(
      (key) => key.toLowerCase() === EXPECTED_TABLE_NAME.toLowerCase()
    );

    if (matchedKey) {
      const tableWrapper = worksheet.getTable(matchedKey);
      const tableModel = (tableWrapper as any)?.table;
      if (tableModel?.tableRef && Array.isArray(tableModel.columns)) {
        const [startRef, endRef] = String(tableModel.tableRef).split(":");
        const start = parseCellRef(startRef);
        const end = endRef ? parseCellRef(endRef) : null;

        if (start && end) {
          const headerRowNumber = start.row;
          const colMap = new Map<number, keyof Omit<RawExcelEventRow, "rowNumber">>();

          tableModel.columns.forEach((colDef: any, idx: number) => {
            const key = resolveHeaderKey(String(colDef?.name || ""));
            if (key) {
              colMap.set(start.col + idx, key);
            }
          });

          if (colMap.size > 0) {
            return extractRowsByColumnMap(worksheet, headerRowNumber + 1, end.row, colMap);
          }
        }
      }
    }
  }

  // 2. Fallback: cari header di baris 1..5 pada sheet pertama (atau sheet dengan kolom EventId)
  for (const worksheet of workbook.worksheets) {
    const maxHeaderScan = Math.min(5, worksheet.rowCount);
    for (let r = 1; r <= maxHeaderScan; r++) {
      const row = worksheet.getRow(r);
      const colMap = new Map<number, keyof Omit<RawExcelEventRow, "rowNumber">>();

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const headerText = extractCellText(cell.value);
        const key = resolveHeaderKey(headerText);
        if (key) {
          colMap.set(colNumber, key);
        }
      });

      if (colMap.has(findColForKey(colMap, "EventId")) || Array.from(colMap.values()).includes("EventId")) {
        return extractRowsByColumnMap(worksheet, r + 1, worksheet.rowCount, colMap);
      }
    }
  }

  throw new Error(
    `Tabel '${EXPECTED_TABLE_NAME}' atau header kolom 'EventId' tidak ditemukan di file Excel.`
  );
}

function findColForKey(
  colMap: Map<number, keyof Omit<RawExcelEventRow, "rowNumber">>,
  target: keyof Omit<RawExcelEventRow, "rowNumber">
): number {
  for (const [col, key] of colMap.entries()) {
    if (key === target) return col;
  }
  return -1;
}

function extractRowsByColumnMap(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  colMap: Map<number, keyof Omit<RawExcelEventRow, "rowNumber">>
): RawExcelEventRow[] {
  const rows: RawExcelEventRow[] = [];

  for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
    const excelRow = worksheet.getRow(rowNum);
    const rawRow: RawExcelEventRow = { rowNumber: rowNum };
    let hasAnyValue = false;

    for (const [colNum, fieldKey] of colMap.entries()) {
      const cellValue = excelRow.getCell(colNum).value;
      if (cellValue !== null && cellValue !== undefined && cellValue !== "") {
        hasAnyValue = true;
      }
      rawRow[fieldKey] = cellValue;
    }

    if (hasAnyValue) {
      rows.push(rawRow);
    }
  }

  return rows;
}
