import { describe, it, expect } from "vitest";
import { hitungSolvabilitas, AMBANG_WASPADA } from "../solvency.js";

const dasar = {
  sisaKantong: 0,
  belumDialokasikan: 0,
  tagihanBelumLunas: 0,
  alokasiTabunganBelumTersetor: 0,
};

describe("hitungSolvabilitas", () => {
  it("MENYERTAKAN gaji yang belum dialokasikan, bukan hanya sisa kantong", () => {
    // Ini koreksi terpenting atas rancangan awal. Dengan rumus lama
    // (hanya sisaKantong) hasilnya 2.400.000 - 2.500.000 = negatif -> DANGER,
    // padahal masih ada 2.100.000 gaji yang belum dialokasikan.
    const hasil = hitungSolvabilitas({
      ...dasar,
      sisaKantong: 2_400_000,
      belumDialokasikan: 2_100_000,
      tagihanBelumLunas: 1_500_000,
      alokasiTabunganBelumTersetor: 1_000_000,
    });
    expect(hasil.uangTersedia).toBe(4_500_000);
    expect(hasil.sisaAman).toBe(2_000_000);
    expect(hasil.zone).toBe("SAFE");
  });

  it("DANGER ketika komitmen melebihi seluruh uang tersedia", () => {
    const hasil = hitungSolvabilitas({
      ...dasar,
      sisaKantong: 1_200_000,
      tagihanBelumLunas: 1_750_000,
    });
    expect(hasil.sisaAman).toBe(-550_000);
    expect(hasil.shortfall).toBe(550_000);
    expect(hasil.zone).toBe("DANGER");
  });

  it("WARNING ketika sisa aman menipis di bawah ambang", () => {
    // uangTersedia 1.000.000, ambang 10% = 100.000. Sisa aman 50.000.
    const hasil = hitungSolvabilitas({
      ...dasar,
      sisaKantong: 1_000_000,
      tagihanBelumLunas: 950_000,
    });
    expect(hasil.sisaAman).toBe(50_000);
    expect(hasil.zone).toBe("WARNING");
  });

  it("SAFE tepat di ambang, WARNING sedikit di bawahnya", () => {
    const tepat = hitungSolvabilitas({
      ...dasar,
      sisaKantong: 1_000_000,
      tagihanBelumLunas: 1_000_000 * (1 - AMBANG_WASPADA),
    });
    expect(tepat.zone).toBe("SAFE");

    const kurang = hitungSolvabilitas({
      ...dasar,
      sisaKantong: 1_000_000,
      tagihanBelumLunas: 1_000_000 * (1 - AMBANG_WASPADA) + 1,
    });
    expect(kurang.zone).toBe("WARNING");
  });

  it("shortfall nol pada zona selain DANGER", () => {
    const aman = hitungSolvabilitas({ ...dasar, sisaKantong: 5_000_000 });
    expect(aman.zone).toBe("SAFE");
    expect(aman.shortfall).toBe(0);
  });

  it("tanpa uang dan tanpa komitmen bukan SAFE, melainkan WARNING", () => {
    // Nol dibanding nol secara matematis 'aman', tapi memberi tahu pengguna
    // 'aman' saat ia tidak punya uang sama sekali adalah rasa tenang palsu.
    expect(hitungSolvabilitas({ ...dasar }).zone).toBe("WARNING");
  });

  it("tanpa uang tapi punya komitmen adalah DANGER", () => {
    const hasil = hitungSolvabilitas({ ...dasar, tagihanBelumLunas: 300_000 });
    expect(hasil.zone).toBe("DANGER");
    expect(hasil.shortfall).toBe(300_000);
  });

  it("setoran yang sudah masuk mengurangi komitmen tabungan", () => {
    // Alokasi 1jt, sudah disetor 600rb -> sisa komitmen 400rb.
    const hasil = hitungSolvabilitas({
      ...dasar,
      sisaKantong: 2_000_000,
      alokasiTabunganBelumTersetor: 400_000,
    });
    expect(hasil.komitmenTersisa).toBe(400_000);
    expect(hasil.sisaAman).toBe(1_600_000);
  });
});
