# Alur Uji Manual — Rencana Keuangan

**Disusun:** 30 Agustus 2026 · Menyertai `rencana_tabungan_tagihan.md`

Dokumen ini berisi yang **belum bisa diverifikasi otomatis**. Yang sudah hijau
tanpa campur tangan manusia tidak diulang di sini:

| Sudah otomatis | Hasil |
|---|---|
| `npm test` (backend) | 45 lulus di 10 berkas |
| `tsc --noEmit` | bersih |
| `npm run lint:design` (frontend) | 18 aturan, 0 pelanggaran |
| `npm run build` | sukses, chunk `PlansPage` ter-emit |
| Integritas data pasca-migrasi | 18 user, 857 transaksi, 67 kantong — tidak berubah |

**Kenapa perlu uji manual sama sekali.** Seluruh halaman fitur ini ada di balik
autentikasi, dan CORS backend staging hanya mengizinkan `http://localhost:5173`.
Build hijau **bukan** bukti aplikasi hidup — pelajaran yang sudah tercatat di
`AGENTS.md` catatan 9-11, dan sudah pernah meloloskan layar putih ke pengguna.

Jalankan dengan `npm run dev` (port 5173) agar backend staging menerima permintaan.

---

## A. Perbaikan yang sudah dirilis ke staging

### A1. Notifikasi dobel pada periode Tutup Buku — **paling penting**

| Langkah | Yang diharapkan |
|---|---|
| Buka **Kantong Keuangan** → Catat Transaksi | Modal terbuka |
| Isi nominal, pilih kategori, set tanggal ke periode yang sudah Tutup Buku (mis. Mei 2026) | — |
| Simpan | **SATU toast kuning** berisi pesan tutup buku |

**Gagal bila:** muncul dua toast (kuning + merah) seperti sebelumnya, atau
toastnya merah. Merah berarti tanda `__handled` tidak sampai ke `notify.error`.

Ulangi pada **edit** transaksi lama ke periode tertutup — perbaikannya ada di dua
tempat (`submitTransaction` dan `updateTransaction`), jadi keduanya perlu dicek.

### A2. Modal Kelola Kantong

| Langkah | Yang diharapkan |
|---|---|
| Gulir ke tengah daftar kantong, lalu tekan **+ Kantong** | Kartu baru muncul di **paling atas** dan daftar ikut tergulir ke sana |
| Perhatikan panel ringkasan di header | Ada baris **"Belum dialokasikan"** dengan persen **dan** rupiah |
| Tekan **"Pakai sisa N%"** pada kartu kosong | Input persentase langsung terisi angka sisa |
| Isi kantong sampai total 100% | Baris sisa menampilkan `0%` dan tombol "Pakai sisa" hilang |
| Isi melebihi 100% | Peringatan merah lama muncul, tombol Simpan terkunci |

---

## B. Tagihan & Cicilan (belum dirilis)

Halaman baru: **Rencana Keuangan** (`/app/plans`), menu di grup Keuangan.

### B1. Tagihan bulanan biasa

1. Tab **Tagihan** → **Tagihan Baru**
2. Isi: nama `Kos`, nominal `1.100.000`, kantong `Tempat Tinggal`, frekuensi
   `Bulanan`, tanggal jatuh tempo `5`, kosongkan jumlah angsuran
3. Simpan

| Periksa | Yang diharapkan |
|---|---|
| Kartu tagihan | Muncul dengan nominal dan nama kantong |
| Label tenggat | Tanggal jatuh tempo di **siklus berjalan**, bukan tanggal 5 bulan kalender ini |

**Ini uji terpenting di seluruh dokumen.** Kalau payday-mu tanggal 25 dan hari
ini tanggal 28 Agustus, tagihan tanggal 5 harus tampil sebagai **5 September**.
Kalau tampil 5 Agustus, pemetaan siklus salah dan pelunasan akan ditolak database.

### B2. Menandai lunas

| Langkah | Yang diharapkan |
|---|---|
| Tekan **Tandai Lunas** | Modal muncul, nominal terisi perkiraan |
| Ubah nominal jadi `1.250.000`, simpan | Toast sukses; kartu jadi "Sudah dibayar bulan ini" |
| Buka **Riwayat Transaksi** | Ada pengeluaran baru `Kos` sebesar **1.250.000** |
| Buka **Kantong Keuangan** | Kantong `Tempat Tinggal` berkurang **1.250.000** |
| Kembali ke Rencana → kartu Kos | Perkiraan tagihan **tetap 1.100.000**, tidak ikut berubah |

**Gagal bila:** kantong berkurang 1.100.000 (nominal koreksi diabaikan), atau
perkiraan tagihan ikut berubah jadi 1.250.000.

### B3. Membatalkan pelunasan

| Langkah | Yang diharapkan |
|---|---|
| Tekan **Batalkan** pada tagihan yang sudah lunas | Kartu kembali ke "N hari lagi" |
| Buka Riwayat Transaksi | Transaksi `Kos` **hilang** |
| Buka Kantong Keuangan | Limit kantong kembali seperti semula |

**Gagal bila:** transaksinya tertinggal — pengeluaran tercatat tanpa tagihan yang
lunas adalah kondisi yang paling membingungkan pengguna.

### B4. Melewati tagihan

| Langkah | Yang diharapkan |
|---|---|
| Tekan **Lewati** | Kartu jadi "Dilewati bulan ini" |
| Buka Riwayat Transaksi | **Tidak ada** transaksi baru |
| Buka Kantong Keuangan | Angka kantong **tidak berubah sama sekali** |

### B5. Cicilan bertenor

1. Buat tagihan: nama `Motor`, nominal `850.000`, frekuensi `Bulanan`,
   **jumlah angsuran `3`** (dipersingkat agar bisa diuji tuntas)
2. Tandai lunas → badge berubah `1/3`
3. Batalkan → badge kembali `0/3`
4. Tandai lunas lagi → `1/3`

Untuk menguji tenor habis tanpa menunggu tiga bulan, ubah `paidInstallments`
langsung di database ke `2`, lalu tandai lunas sekali lagi:

| Periksa | Yang diharapkan |
|---|---|
| Badge | `3/3` |
| Badge status | **"Lunas semua"** |
| Tombol Tandai Lunas | **Hilang** — cicilan berhenti menagih sendiri |
| Kartu Alokasi Lain / bar solvabilitas | Motor tidak lagi dihitung sebagai komitmen |

### B6. Validasi yang harus ditolak

| Masukan | Pesan yang diharapkan |
|---|---|
| Nama kosong | "Nama tagihan wajib diisi." |
| Tanggal jatuh tempo `0` atau `32` | "Tanggal jatuh tempo harus antara 1 sampai 31." |
| Frekuensi Tahunan tanpa bulan | "Tagihan tahunan wajib menyertakan bulan jatuh tempo." |
| Jumlah angsuran `0` | "Jumlah angsuran minimal 1." |

Pilihan **Mingguan** sengaja tidak ditawarkan di dropdown. Satu siklus gajian
memuat empat sampai lima jatuh tempo mingguan, sementara pelunasan hanya bisa
dicatat sekali per siklus.

### B7. Tagihan tanggal 31 di bulan pendek

Buat tagihan dengan jatuh tempo `31`. Pada siklus yang berakhir di Februari,
tanggal yang tampil harus **28 Februari** (atau 29 di tahun kabisat), bukan
meluber ke Maret.

---

## C. Wishlist Tabungan (belum dirilis)

### C1. Membuat wishlist dan efeknya ke budget

1. Catat **Sisa Gaji Pokok** di Kantong Keuangan sekarang: `_______`
2. Catat **belum dialokasikan** di modal Kelola Kantong: `_______`
3. Tab **Tabungan** → **Wishlist Baru**: ikon `🏝️`, nama `Jalan ke Bali`,
   target `10.000.000`, sisihkan per bulan `1.000.000`

| Periksa | Yang diharapkan |
|---|---|
| Kartu wishlist | Progress `0%`, "kurang Rp10.000.000" |
| Modal Kelola Kantong → belum dialokasikan | **Berkurang Rp1.000.000** dari angka di langkah 2 |

**Gagal bila angkanya tidak berubah.** Itu berarti `/budget/summary` belum
mengurangi alokasi wishlist, dan aplikasi memberi tahu pengguna ada uang bebas
yang sebenarnya sudah dijanjikan.

### C2. Menyetor

| Langkah | Yang diharapkan |
|---|---|
| Tekan **Setor**, isi `3.000.000`, simpan | Progress jadi **30%**, terkumpul Rp3.000.000 |
| Kartu wishlist | Ada perkiraan selesai, mis. "7 bulan lagi" |
| Buka **Riwayat Transaksi** | **Tidak ada** pengeluaran baru |
| Buka grafik tren di Kantong Keuangan | Garis pengeluaran **tidak naik** |

**Gagal bila setoran muncul sebagai pengeluaran.** Tabungan adalah pemindahan
uang, bukan konsumsi; mencatatnya sebagai EXPENSE akan mencemari `totalSpent`,
grafik tren, `!monthly`, dan evaluasi AI sekaligus.

### C3. Menarik

| Langkah | Yang diharapkan |
|---|---|
| Setor → tab **Tarik** → `1.000.000` | Terkumpul jadi Rp2.000.000, progress `20%` |
| Tarik melebihi yang terkumpul | Ditolak: "Penarikan melebihi jumlah yang terkumpul." |

### C4. Target tercapai

Setor sampai terkumpul ≥ target.

| Periksa | Yang diharapkan |
|---|---|
| Badge | **"Tercapai"** |
| Progress bar | Penuh, warna sukses — **bukan** merah. Di kartu ini penuh berarti bagus |
| Kelola Kantong → belum dialokasikan | Alokasi berhenti memotong budget |
| Kartu wishlist | Tetap ada, tidak hilang sendiri |

---

## D. Penjaga Solvabilitas

### D1. Ketiga zona

Bar di atas halaman Rencana. Rumusnya:

```
sisaAman = (sisa kantong + gaji belum dialokasikan)
           − (tagihan belum lunas + alokasi tabungan belum tersetor)
```

| Kondisi yang dibuat | Zona | Tampilan |
|---|---|---|
| Komitmen jauh di bawah uang tersedia | 🟢 Hijau | "Komitmen bulan ini aman" |
| Komitmen menyisakan < 10% uang tersedia | 🟡 Kuning | "Uang cukup, tapi tipis" |
| Komitmen melebihi uang tersedia | 🔴 Merah | "Uangmu kurang untuk tagihan bulan ini" + nominal kurangnya |

Cara tercepat memicu merah: buat tagihan bernominal lebih besar dari sisa gaji.

### D2. Gaji yang belum dialokasikan HARUS ikut dihitung

Ini koreksi terpenting atas rancangan awal.

1. Pastikan ada gaji yang belum masuk kantong mana pun (mis. kantong total 60% saja)
2. Buat tagihan yang nominalnya **melebihi sisa kantong** tapi **masih di bawah
   sisa kantong + gaji belum dialokasikan**

| Periksa | Yang diharapkan |
|---|---|
| Zona | **Hijau atau kuning**, bukan merah |
| Rincian bar | "Belum dialokasikan" menampilkan angka yang benar |

**Gagal bila merah.** Itu berarti rumusnya kembali hanya memakai sisa kantong dan
membuang gaji yang belum dialokasikan — uang yang nyata ada di rekening.

### D3. Zona kuning tidak boleh mengirim notifikasi

Masuk ke zona kuning, lalu tunggu / picu ulang. Tidak boleh ada toast maupun
pesan WhatsApp. Kuning hanya mengubah warna bar. Hanya merah yang pantas
mengganggu pengguna.

---

## E. Tampilan di halaman lain

### E1. Kartu "Alokasi Lain" di Kantong Keuangan

Muncul di dalam grid **Rincian Kantong**, berdampingan dengan kantong biasa.

| Periksa | Yang diharapkan |
|---|---|
| Kartu muncul | Hanya bila ada wishlist beralokasi atau tagihan tanpa kantong |
| Isinya | Wishlist + tagihan yang kategorinya **belum punya kantong** |
| Tagihan yang kategorinya **sudah** punya kantong | **TIDAK** ikut dijumlahkan di sini |

**Uji dobel hitung — wajib.** Buat tagihan `Kos` dengan kategori yang sudah punya
kantong. Kos **tidak boleh** muncul di kartu Alokasi Lain. Kalau muncul, uangnya
terhitung dua kali dan total alokasi di layar akan melebihi gaji.

### E2. Baris zona di kartu utama

Di bawah angka **Sisa Gaji Pokok**, satu baris: "Sisa aman Rp… setelah komitmen",
atau saat merah: "Kurang Rp… untuk menutup komitmen bulan ini".

### E3. Kartu "Tagihan Mendatang" di Dashboard utama

| Periksa | Yang diharapkan |
|---|---|
| Posisi | Kolom kanan, **di atas** System Updates |
| Isi | Maksimal **3** tagihan terdekat |
| Isi | **Hanya tagihan**, tidak ada wishlist |
| Saat zona merah | Border kartu memerah + baris peringatan nominal kurang |
| Tanpa tagihan terbuka | "Tidak ada tagihan yang perlu dibayar dalam waktu dekat." |

---

## F. Lintas tema dan layar

Fitur ini menambah warna status baru, jadi perlu dilihat di **keempat** tema:
Light, Dark, Factory, dan Spidey.

| Periksa | Yang diharapkan |
|---|---|
| Bar solvabilitas ketiga zona | Terbaca di keempat tema, tidak ada blok tanpa warna |
| Progress bar wishlist | Terlihat di keempat tema |
| Lebar 375px | Tidak ada yang terpotong; tombol aksi tetap terjangkau |
| Buku Panduan | Tombolnya ada di halaman Rencana Keuangan |

---

## G. Yang belum dibangun

Supaya tidak diuji lalu dilaporkan sebagai bug:

| Belum ada | Fase |
|---|---|
| Pengingat WhatsApp otomatis (cron 07:00 WIB) | 8 |
| Perintah bot `!bills`, `!paid`, `!skip`, `!goals`, `!nabung` | 8 |
| Setoran otomatis awal siklus dari alokasi bulanan | 8 |
| Peringatan merah terkirim otomatis setelah mencatat transaksi | 8 |
| Simpan/terapkan template kantong di UI (endpoint sudah ada) | 0d sisa |
| `totalSaved` terisi di rekap bulanan | 9 |
| Komitmen masuk konteks reasoning AI | 9 |

Setoran wishlist saat ini **hanya manual**. Progress tidak bergerak sendiri di
awal siklus sampai Fase 8 selesai.
