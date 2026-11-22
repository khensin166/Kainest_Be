/**
 * src/features/plans/domain/solvency.ts
 *
 * Penjaga solvabilitas: menjawab "apakah uangku akan cukup untuk tagihan
 * bulan ini?" — pertanyaan yang membuat fitur tagihan & wishlist layak dibangun.
 *
 * Rumusnya menghitung SELURUH uang yang masih bisa dipakai, bukan hanya sisa
 * kantong. Rancangan awal hanya memakai `totalRemaining` dan membuang
 * `unallocated`; itu bukan sekadar terlalu ketat, itu keliru — gaji yang belum
 * dialokasikan tetap ada di rekening dan tetap bisa membayar tagihan.
 *
 * Tidak dobel hitung: tagihan yang kategorinya punya kantong belum terpakai
 * uangnya ada di `totalRemaining` lalu dikurangi lagi sebagai komitmen, hasilnya
 * nol untuk bagian itu — benar, karena setelah dibayar kantongnya memang habis.
 * Tagihan tanpa kantong tidak masuk `totalLimit`, jadi uangnya diambil dari
 * `unallocated`. Satu rumus, dua kasus, keduanya benar.
 */
/**
 * Ambang zona kuning: 10% dari uang tersedia.
 *
 * Dijadikan konstanta bernama karena angkanya masih tebakan — diturunkan dari
 * zona kantong makan di Finance Tech.md dan pantas disetel ulang setelah dipakai
 * sebulan.
 */
export const AMBANG_WASPADA = 0.1;
export function hitungSolvabilitas(input) {
    const uangTersedia = input.sisaKantong + input.belumDialokasikan;
    const komitmenTersisa = input.tagihanBelumLunas + input.alokasiTabunganBelumTersetor;
    const sisaAman = uangTersedia - komitmenTersisa;
    let zone;
    if (sisaAman < 0) {
        zone = "DANGER";
    }
    else if (uangTersedia > 0 && sisaAman < uangTersedia * AMBANG_WASPADA) {
        zone = "WARNING";
    }
    else if (uangTersedia <= 0) {
        // Tidak ada uang tersedia sama sekali dan tidak ada komitmen: bukan bahaya,
        // tapi juga bukan aman. Diperlakukan sebagai waspada agar tidak memberi
        // rasa tenang palsu.
        zone = komitmenTersisa > 0 ? "DANGER" : "WARNING";
    }
    else {
        zone = "SAFE";
    }
    return {
        sisaKantong: input.sisaKantong,
        belumDialokasikan: input.belumDialokasikan,
        uangTersedia,
        tagihanBelumLunas: input.tagihanBelumLunas,
        alokasiTabunganBelumTersetor: input.alokasiTabunganBelumTersetor,
        komitmenTersisa,
        sisaAman,
        shortfall: sisaAman < 0 ? Math.abs(sisaAman) : 0,
        zone,
    };
}
