import { describe, it, expect } from "vitest";
import {
  cariJatuhTempoDiSiklus,
  periodeSiklus,
  sisaHari,
  frekuensiDidukung,
  type BillCycleInput,
} from "../billCycle.js";

function format(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Tagihan bulanan dengan tanggal mulai jauh di belakang agar tidak mengganggu uji. */
function tagihanBulanan(dueDay: number): BillCycleInput {
  return { frequency: "MONTHLY", dueDay, startDate: new Date(2020, 0, 1) };
}

describe("billCycle", () => {
  describe("cariJatuhTempoDiSiklus - MONTHLY", () => {
    it("menempatkan tagihan tanggal 5 di BULAN BERIKUTNYA ketika payday 25", () => {
      // Ini inti dari seluruh fitur. Siklus 25 Agu - 24 Sep memuat 5 September,
      // bukan 5 Agustus. Salah di sini = tagihan masuk siklus yang keliru.
      const acuan = new Date(2026, 7, 28);
      expect(format(cariJatuhTempoDiSiklus(tagihanBulanan(5), acuan, 25))).toBe("2026-09-05");
    });

    it("menempatkan tagihan tanggal 28 di bulan yang sama ketika payday 25", () => {
      const acuan = new Date(2026, 7, 28);
      expect(format(cariJatuhTempoDiSiklus(tagihanBulanan(28), acuan, 25))).toBe("2026-08-28");
    });

    it("memakai siklus yang dimulai bulan lalu ketika payday belum tercapai", () => {
      const acuan = new Date(2026, 7, 10); // siklus masih 25 Jul - 24 Agu
      expect(format(cariJatuhTempoDiSiklus(tagihanBulanan(5), acuan, 25))).toBe("2026-08-05");
    });

    it("membatasi tanggal 31 ke hari terakhir Februari, bukan meluber ke Maret", () => {
      const acuan = new Date(2027, 0, 26); // siklus 25 Jan - 24 Feb 2027
      expect(format(cariJatuhTempoDiSiklus(tagihanBulanan(31), acuan, 25))).toBe("2027-01-31");

      const acuanFeb = new Date(2027, 1, 26); // siklus 25 Feb - 24 Mar
      expect(format(cariJatuhTempoDiSiklus(tagihanBulanan(31), acuanFeb, 25))).toBe("2027-02-28");
    });

    it("bekerja untuk payday 31 (akhir bulan), nilai default aplikasi", () => {
      const acuan = new Date(2027, 1, 10);
      expect(format(cariJatuhTempoDiSiklus(tagihanBulanan(15), acuan, 31))).toBe("2027-02-15");
    });

    it("mengembalikan null bila tagihan belum berlaku di siklus ini", () => {
      const tagihan: BillCycleInput = {
        frequency: "MONTHLY",
        dueDay: 5,
        startDate: new Date(2027, 0, 1),
      };
      expect(cariJatuhTempoDiSiklus(tagihan, new Date(2026, 7, 28), 25)).toBeNull();
    });
  });

  describe("cariJatuhTempoDiSiklus - ONE_TIME", () => {
    it("mengembalikan tanggalnya bila jatuh di dalam siklus", () => {
      const tagihan: BillCycleInput = {
        frequency: "ONE_TIME",
        dueDay: 10,
        startDate: new Date(2026, 8, 1),
      };
      expect(format(cariJatuhTempoDiSiklus(tagihan, new Date(2026, 7, 28), 25))).toBe("2026-09-10");
    });

    it("mengembalikan null bila tanggalnya di luar siklus", () => {
      const tagihan: BillCycleInput = {
        frequency: "ONE_TIME",
        dueDay: 10,
        startDate: new Date(2026, 10, 1),
      };
      expect(cariJatuhTempoDiSiklus(tagihan, new Date(2026, 7, 28), 25)).toBeNull();
    });
  });

  describe("cariJatuhTempoDiSiklus - YEARLY", () => {
    it("menemukan tagihan tahunan yang jatuh di siklus ini", () => {
      const tagihan: BillCycleInput = {
        frequency: "YEARLY",
        dueDay: 10,
        dueMonth: 9,
        startDate: new Date(2020, 0, 1),
      };
      expect(format(cariJatuhTempoDiSiklus(tagihan, new Date(2026, 7, 28), 25))).toBe("2026-09-10");
    });

    it("mengembalikan null di bulan lain sepanjang tahun", () => {
      const tagihan: BillCycleInput = {
        frequency: "YEARLY",
        dueDay: 10,
        dueMonth: 3,
        startDate: new Date(2020, 0, 1),
      };
      expect(cariJatuhTempoDiSiklus(tagihan, new Date(2026, 7, 28), 25)).toBeNull();
    });
  });

  describe("frekuensi yang belum didukung", () => {
    it("menolak WEEKLY, karena satu siklus memuat lebih dari satu jatuh tempo", () => {
      expect(frekuensiDidukung("WEEKLY")).toBe(false);
      expect(frekuensiDidukung("MONTHLY")).toBe(true);
      const tagihan: BillCycleInput = {
        frequency: "WEEKLY",
        dueDay: 1,
        startDate: new Date(2020, 0, 1),
      };
      expect(cariJatuhTempoDiSiklus(tagihan, new Date(2026, 7, 28), 25)).toBeNull();
    });
  });

  describe("periodeSiklus", () => {
    it("memakai kunci yang sama dengan MonthlyFinancialHistory.period", () => {
      const period = periodeSiklus(new Date(2026, 7, 28), 25);
      expect(period.toISOString().slice(0, 10)).toBe("2026-09-01");
    });

    it("dua tanggal dalam siklus yang sama menghasilkan period identik", () => {
      // Jaminan yang menopang @@unique([billId, period]): pelunasan kapan pun
      // di dalam satu siklus harus jatuh ke kunci yang sama.
      const a = periodeSiklus(new Date(2026, 7, 26), 25);
      const b = periodeSiklus(new Date(2026, 8, 20), 25);
      expect(a.getTime()).toBe(b.getTime());
    });
  });

  describe("sisaHari", () => {
    it("menghitung maju, mundur, dan hari-H", () => {
      const acuan = new Date(2026, 7, 28, 13, 45);
      expect(sisaHari(new Date(2026, 8, 4), acuan)).toBe(7);
      expect(sisaHari(new Date(2026, 7, 28), acuan)).toBe(0);
      expect(sisaHari(new Date(2026, 7, 25), acuan)).toBe(-3);
    });
  });
});
