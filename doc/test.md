# Rencana Keuangan — Status, Serah-Terima & Alur Uji

**Terakhir diperbarui:** 30 Agustus 2026
**Rancangan lengkap:** [`rencana_tabungan_tagihan.md`](./rencana_tabungan_tagihan.md)

Dokumen ini untukmu yang membuka lagi pekerjaan ini setelah jeda. Isinya tiga hal:
apa yang **sudah jadi**, apa yang **belum** beserta cara melanjutkannya, dan alur
uji manual yang belum bisa dijalankan otomatis.

| Repo | Branch | Commit |
|---|---|---|
| Kainest (frontend) | `staging` | `f196db7` |
| Kainest_Be (backend) | `staging` | `e4e52ec` |

Migrasi database **sudah diterapkan** ke Supabase.

---

## 1. Checklist

### Sudah selesai

- [x] **Fase 0a** — Notifikasi dobel pada periode Tutup Buku
- [x] **Fase 0b** — Kantong baru muncul di atas daftar
- [x] **Fase 0c** — Sisa persentase belum dialokasikan + tombol "Pakai sisa"
- [x] **Fase 1** — Skema: 6 model, 6 enum, migrasi diterapkan
- [x] **Fase 2** — Backend tagihan & cicilan (8 endpoint)
- [x] **Fase 4** — Backend wishlist tabungan (7 endpoint)
- [x] **Fase 6** — Penjaga solvabilitas (`GET /plans/health`)
- [x] **Fase 3** — Frontend tab Tagihan
- [x] **Fase 5** — Frontend tab Tabungan
- [x] **Fase 7** — Kartu Alokasi Lain, baris zona, widget Dashboard
- [x] `GET /budget/summary` mengurangi alokasi wishlist dari `unallocated`

### Belum selesai

- [ ] **Fase 0d (sisa)** — UI template kantong. *Backend & store sudah ada, tinggal UI.*
- [ ] **Fase 8** — Cron pengingat, perintah bot, setoran otomatis awal siklus
- [ ] **Fase 9** — `totalSaved` di rekap bulanan, komitmen masuk konteks AI

### Verifikasi otomatis yang sudah hijau

| Perintah | Hasil |
|---|---|
| `npm test` (backend) | 45 lulus di 10 berkas |
| `npx tsc --noEmit` | bersih |
| `npm run lint:design` (frontend) | 18 aturan, 0 pelanggaran |
| `npm run build` (frontend) | sukses, chunk `PlansPage` 35 KB |

---

## 2. Apa yang sudah dikerjakan

### 2.1 Perbaikan halaman Kantong Keuangan (Fase 0a–0c)

**Notifikasi dobel.** Menambah transaksi ke periode Tutup Buku memunculkan dua
toast: kuning dari store dan merah dari form. Penyebabnya dua lapisan sama-sama
memberi tahu pengguna — `useBudgetStore` memanggil `notify.warning` lalu tetap
mengembalikan `success: false`, dan `TransactionForm` membaca kegagalan itu lalu
memanggil `notify.error`.

Diperbaiki dengan menandai balikan `__handled: true`. Mekanismenya sudah ada sejak
`notify.js` dibuat. Ada di **dua tempat**: `submitTransaction` dan `updateTransaction`.

Warning tetap di store, bukan dipindah ke form — Tutup Buku adalah **aturan**,
bukan kegagalan, jadi nadanya memang kuning. Dan hanya store yang bisa
membedakannya karena hanya store yang membaca `result.left.code`.

**Kantong baru di atas.** `push()` → `unshift()` plus gulir ke atas. Tanpa gulir,
pengguna yang sedang di tengah daftar tidak melihat apa pun berubah.

**Sisa persentase.** Total terpakai sudah ada sebelumnya; yang belum ada adalah
sisanya. Ditampilkan dalam persen **dan** rupiah — "23%" tidak terasa apa-apa
sampai terbaca sebagai Rp1.380.000.

### 2.2 Skema (Fase 1)

Enam model di `prisma/schema.prisma`:

| Model | Fungsi |
|---|---|
| `RecurringBill` | Tagihan berulang & cicilan bertenor (`totalInstallments`) |
| `BillPayment` | Satu baris per tagihan per siklus |
| `SavingGoal` | Wishlist tabungan |
| `SavingContribution` | Setoran; nominal negatif = penarikan |
| `CommitmentAlert` | Penjaga anti-spam peringatan (**belum dipakai**, untuk Fase 8) |
| `PocketTemplate` | Template susunan kantong |

Plus kolom nullable `MonthlyFinancialHistory.commitmentsSnapshot` (**belum diisi**,
untuk Fase 9).

Migrasi `20260830000000` dihasilkan lewat `prisma migrate diff`, bukan ditulis
tangan, supaya penamaan indeks dan constraint persis sesuai harapan Prisma.

### 2.3 Backend (Fase 2, 4, 6)

Slice `src/features/plans/`:

```
data/     BillRepository, SavingGoalRepository, PocketTemplateRepository,
          PlanContextRepository
domain/   billCycle.ts        pemetaan jatuh tempo -> siklus payday (murni, 14 uji)
          solvency.ts         rumus zona (murni, 8 uji)
          billService.ts      aturan bisnis tagihan
          savingService.ts    aturan bisnis wishlist
          planHealthService.ts
          pocketTemplateService.ts
services/     plansController.ts
presentation/ plansRoute.ts -> app.route("/plans")
```

20 endpoint: 8 tagihan, 7 wishlist, 1 solvabilitas, 4 template kantong.

### 2.4 Frontend (Fase 3, 5, 7)

Slice `src/features/plans/` mengikuti irisan vertikal yang sama seperti fitur lain,
dengan kontrak `Either` (bukan `try/catch`).

Halaman baru `/app/plans` dengan dua tab. Penempatan di halaman lama:

| Lokasi | Isi |
|---|---|
| Rincian Kantong | Kartu "Alokasi Lain" |
| `BudgetHeroCard` | Satu baris zona di bawah angka sisa |
| Dashboard utama | Kartu "Tagihan Mendatang", kolom kanan |

---

## 3. Keputusan yang perlu diingat sebelum melanjutkan

Delapan hal ini sudah tertanam di kode. Kalau lupa, mudah tanpa sengaja merusaknya.

**1. Tagihan menghasilkan `Transaction`, tabungan tidak.**
Tagihan adalah konsumsi — harus memotong limit kantongnya. Tabungan adalah
pemindahan; kalau dicatat sebagai EXPENSE ia mencemari `totalSpent`, grafik tren,
`!monthly`, dan evaluasi AI sekaligus.

**2. Jatuh tempo dipetakan ke siklus payday, bukan bulan kalender.**
Payday 25, tagihan tanggal 5 → masuk siklus yang **dimulai bulan sebelumnya**.
Semua pemetaan wajib lewat `getCycleBoundaries`. Salah di sini membuat
`@@unique([billId, period])` menolak pelunasan yang sah.

**3. `sisaAman` menyertakan gaji yang belum dialokasikan.**
```
sisaAman = (sisaKantong + belumDialokasikan) − (tagihanBelumLunas + alokasiBelumTersetor)
```
Rancangan awal hanya memakai `sisaKantong`; itu bukan sekadar terlalu ketat,
melainkan keliru — gaji yang belum dialokasikan tetap ada di rekening.

**4. Alokasi Lain hanya memuat komitmen yang tidak punya kantong sendiri.**
Tagihan yang kategorinya sudah punya kantong uangnya sudah terwakili limit kantong
itu. Menghitungnya lagi membuat total alokasi di layar melebihi gaji.

**5. Hanya zona merah yang mengirim pesan.**
Kuning cukup mengubah warna di UI. Peringatan yang datang tiap hari akan diabaikan
dalam seminggu, lalu botnya dibisukan.

**6. Tidak ada pencatatan otomatis pembayaran tagihan.**
Pengeluaran hanya tercatat kalau pengguna menekan "Tandai Lunas". Opsi `autoRecord`
sempat ada di rancangan lalu dihapus.

**7. Frekuensi mingguan ditolak, bukan disetengah-implementasikan.**
Satu siklus gajian memuat empat sampai lima jatuh tempo mingguan, sementara
`BillPayment` hanya mengizinkan satu pelunasan per siklus. Enum `WEEKLY` ada di
database tapi divalidasi keluar di `billCycle.ts`, dan tidak ditawarkan di dropdown.

**8. Progress bar wishlist tidak pernah memakai `status-danger`.**
Maknanya terbalik dari kantong: kantong mengukur seberapa banyak sudah
**dihabiskan** (penuh = bahaya), wishlist seberapa banyak sudah **ditunaikan**
(penuh = bagus).

---

## 4. Yang belum dikerjakan, dan cara melanjutkannya

### 4.1 Fase 0d sisa — UI template kantong

**Sudah ada:** tabel `PocketTemplate`, 4 endpoint (`GET/POST/PUT/DELETE
/plans/pocket-templates`), dan aksi store `fetchTemplates`, `createTemplate`,
`deleteTemplate` di `usePlansStore`.

**Belum ada:** UI-nya di `PocketManagementModal.vue`. Backend siap dipakai, tidak
perlu menyentuh database lagi.

Yang perlu dikerjakan:

1. Di bagian "⚡ Blueprint Cepat" yang sudah ada, tambahkan daftar template
   pengguna dari `plansStore.templates`. **Satukan jadi satu daftar** — blueprint
   bawaan jadi "template sistem" yang tak bisa dihapus, template pengguna di daftar
   yang sama. Jangan buat dua konsep sejajar.
2. Tombol **"Simpan sebagai Template"**, meminta nama, mengirim `pocketsData` saat
   ini lewat `createTemplate(name, pockets)`.
3. Menerapkan template **selalu menimpa**, tidak pernah menggabung — menggabung
   memunculkan pertanyaan yang tidak punya jawaban benar (kategori sama beda
   persentase, pakai yang mana?). `applyBlueprint()` sudah menimpa, jadi konsisten.
   Karena menimpa, **wajib konfirmasi** bila `hasChanges` bernilai true.
4. Endpoint `GET` sudah mengembalikan `missingCategoryCount` per template. Pakai
   itu untuk memberi tahu: *"2 kantong dilewati karena kategorinya sudah dihapus."*
   Jangan gagal senyap, jangan pula gagal total.

Perkiraan: satu sesi, hanya frontend.

### 4.2 Fase 8 — Pengingat & bot WhatsApp

**Ini yang paling berdampak dan paling perlu hati-hati**, karena menyentuh GOWA
dan mengirim pesan ke nomor sungguhan. Kerjakan dengan `BOT_ENV_MODE=staging`
supaya hanya `STAGING_ALLOWED_NUMBERS` yang menerima.

Empat bagian:

**a. `BillReminderCron`** — harian 07:00 WIB, pola mengikuti `MonthlyResetCron.ts`
yang sudah ada. Cari tagihan yang jatuh tempo dalam `reminderDaysBefore` hari dan
belum ditandai di siklus ini, lalu blast lewat GOWA. Fungsi kirimnya sudah ada di
`BlastController.ts`. Perhatikan zona waktu: cron berjalan WIB, perbandingan
`dueDay` harus memakai zona yang sama, kalau tidak pengingat H-7 terkirim di H-6.

**b. Setoran otomatis awal siklus** — saat siklus baru dimulai, buat
`SavingContribution` bersumber `AUTO_CYCLE` sebesar `monthlyAllocation`.
`@@unique([goalId, period, source])` sudah menjadi pengaman terhadap cron yang
terpanggil dua kali. **Jangan dilepas demi kemudahan.**

Aturan yang sudah disepakati: kalau siklus berakhir dengan pengeluaran melebihi
budget, setoran otomatis siklus itu **tidak dibuat**, dan pengguna diberi tahu —
*"Bulan ini pengeluaran melebihi budget, setoran Bali Rp1.000.000 dilewati."*
Tanpa aturan ini progress bar naik sendiri walaupun uangnya sudah terpakai.

**c. Peringatan solvabilitas** — panggil `ringkasanKesehatan()` setelah transaksi
baru tercatat (web maupun bot). Kalau zona **jatuh ke merah**, kirim peringatan.
Model `CommitmentAlert` sudah ada dan belum dipakai: `@@unique([userId, period, zone])`
menjamin satu peringatan per zona per siklus. Kirim ulang **hanya** kalau pengguna
sempat kembali ke hijau/kuning lalu jatuh lagi.

**d. Lima perintah bot** di `ProcessBotTransactionUseCase.ts`, mengikuti pola
`!today`/`!balance` yang sudah ada:

| Perintah | Fungsi | Panggil |
|---|---|---|
| `!bills` | Daftar tagihan + zona | `daftarTagihan()` + `ringkasanKesehatan()` |
| `!paid <nama>` | Tandai lunas | `lunasiTagihan()` |
| `!skip <nama>` | Lewati bulan ini | `lewatiTagihan()` |
| `!goals` | Progress wishlist | `daftarWishlist()` |
| `!nabung <nominal> <nama>` | Setor manual | `setorWishlist()` |

Jangan lupa memperbarui `!help` dan tetap memasang Universal Help Footer.

**Konsekuensi selama Fase 8 belum jalan:** setoran wishlist **hanya manual**.
Alokasi bulanan sudah memotong budget, tapi progress tidak bergerak sendiri di
awal siklus sampai bagian (b) selesai.

### 4.3 Fase 9 — Integrasi AI & rekap

1. **`totalSaved` di `syncMonthlyHistory`** — jumlahkan `SavingContribution` pada
   `period` bersangkutan. Kolomnya sudah lama ada di skema tapi tidak pernah terisi.
2. **`commitmentsSnapshot`** — simpan snapshot tagihan & wishlist saat menutup
   siklus. Kolomnya nullable, jadi baris riwayat lama tetap valid.
3. **Konteks AI** — sertakan komitmen di `reasoningAiService.ts` supaya saran
   alokasi tidak bentrok dengan cicilan yang sedang berjalan.

### 4.4 Utang teknis di luar fitur ini

**`prisma.config.ts` kosong** (`defineConfig({})`), dan itulah yang membuat Prisma
6.17 melewati pemuatan `.env` sehingga `DIRECT_URL` tidak terbaca. Setiap perintah
Prisma kena. Selama ini diakali dengan pembungkus sementara. Layak diperbaiki
terpisah.

**`npx prisma` berbahaya di repo bersih.** Kalau `node_modules` belum terpasang,
`npx` menarik versi terbaru dari registry — pernah mengambil **Prisma 8.0.0-rc.12**
padahal proyek mendeklarasikan `^6.17.1`. Jalankan `npm install` dulu, lalu pakai
`./node_modules/.bin/prisma`.

**Empat keputusan produk yang masih terbuka** (rinciannya di §11 rancangan):
tagihan/wishlist bersama pasangan, angka buffer zona kuning 10%, kategori untuk
penarikan tabungan, dan nada pengingat.

---

## 5. Alur uji manual

Yang di bawah ini **belum bisa diverifikasi otomatis**. Seluruh halaman fitur ini
ada di balik autentikasi, dan CORS backend staging hanya mengizinkan
`http://localhost:5173`.

Build hijau **bukan** bukti aplikasi hidup — sudah tercatat di `AGENTS.md` catatan
9–11, dan pernah meloloskan layar putih ke pengguna.

Jalankan dengan `npm run dev` (port 5173).

### A. Perbaikan yang sudah dirilis

#### A1. Notifikasi dobel — paling penting

| Langkah | Yang diharapkan |
|---|---|
| **Kantong Keuangan** → Catat Transaksi | Modal terbuka |
| Isi nominal, pilih kategori, set tanggal ke periode yang sudah Tutup Buku | — |
| Simpan | **SATU toast kuning** |

**Gagal bila:** dua toast (kuning + merah), atau toastnya merah. Merah berarti
tanda `__handled` tidak sampai ke `notify.error`.

Ulangi pada **edit** transaksi lama — perbaikannya ada di dua tempat.

#### A2. Modal Kelola Kantong

| Langkah | Yang diharapkan |
|---|---|
| Gulir ke tengah daftar, tekan **+ Kantong** | Kartu baru di **paling atas**, daftar tergulir ke sana |
| Panel ringkasan header | Ada baris **"Belum dialokasikan"** dengan persen **dan** rupiah |
| Tekan **"Pakai sisa N%"** | Input persentase terisi angka sisa |
| Isi sampai total 100% | Baris sisa `0%`, tombol "Pakai sisa" hilang |
| Isi melebihi 100% | Peringatan merah lama muncul, Simpan terkunci |

### B. Tagihan & Cicilan

Halaman **Rencana Keuangan** (`/app/plans`), menu di grup Keuangan.

#### B1. Pemetaan siklus — uji terpenting

1. Tab **Tagihan** → **Tagihan Baru**
2. Isi: `Kos`, `1.100.000`, kantong `Tempat Tinggal`, `Bulanan`, jatuh tempo `5`,
   kosongkan jumlah angsuran

Kalau payday-mu tanggal 25 dan hari ini 28 Agustus, tagihan tanggal 5 harus tampil
sebagai **5 September**. Kalau tampil 5 Agustus, pemetaan siklus salah dan
pelunasan akan ditolak database.

#### B2. Menandai lunas

| Langkah | Yang diharapkan |
|---|---|
| **Tandai Lunas** | Modal muncul, nominal terisi perkiraan |
| Ubah jadi `1.250.000`, simpan | Kartu jadi "Sudah dibayar bulan ini" |
| **Riwayat Transaksi** | Pengeluaran `Kos` sebesar **1.250.000** |
| **Kantong Keuangan** | Kantong `Tempat Tinggal` berkurang **1.250.000** |
| Kembali ke kartu Kos | Perkiraan **tetap 1.100.000** |

**Gagal bila:** kantong berkurang 1.100.000, atau perkiraan ikut berubah.

#### B3. Membatalkan pelunasan

| Langkah | Yang diharapkan |
|---|---|
| **Batalkan** pada tagihan lunas | Kartu kembali ke "N hari lagi" |
| Riwayat Transaksi | Transaksi `Kos` **hilang** |
| Kantong Keuangan | Limit kembali seperti semula |

**Gagal bila** transaksinya tertinggal — pengeluaran tercatat tanpa tagihan yang
lunas adalah kondisi paling membingungkan bagi pengguna.

#### B4. Melewati tagihan

| Langkah | Yang diharapkan |
|---|---|
| **Lewati** | Kartu jadi "Dilewati bulan ini" |
| Riwayat Transaksi | **Tidak ada** transaksi baru |
| Kantong Keuangan | Angka **tidak berubah sama sekali** |

#### B5. Cicilan bertenor

1. Buat `Motor`, `850.000`, `Bulanan`, **jumlah angsuran `3`**
2. Tandai lunas → badge `1/3`
3. Batalkan → badge `0/3`
4. Tandai lunas lagi → `1/3`

Untuk menguji tenor habis tanpa menunggu tiga bulan, ubah `paidInstallments` di
database jadi `2`, lalu tandai lunas sekali lagi:

| Periksa | Yang diharapkan |
|---|---|
| Badge | `3/3` + **"Lunas semua"** |
| Tombol Tandai Lunas | **Hilang** |
| Bar solvabilitas | Motor tidak lagi dihitung sebagai komitmen |

#### B6. Validasi yang harus ditolak

| Masukan | Pesan |
|---|---|
| Nama kosong | "Nama tagihan wajib diisi." |
| Jatuh tempo `0` atau `32` | "Tanggal jatuh tempo harus antara 1 sampai 31." |
| Tahunan tanpa bulan | "Tagihan tahunan wajib menyertakan bulan jatuh tempo." |
| Jumlah angsuran `0` | "Jumlah angsuran minimal 1." |

Pilihan **Mingguan** sengaja tidak ada di dropdown.

#### B7. Tanggal 31 di bulan pendek

Buat tagihan jatuh tempo `31`. Pada siklus yang berakhir di Februari, harus tampil
**28 Februari** (29 di tahun kabisat), bukan meluber ke Maret.

### C. Wishlist Tabungan

#### C1. Efek ke budget

1. Catat **belum dialokasikan** di modal Kelola Kantong: `_______`
2. Tab **Tabungan** → **Wishlist Baru**: `🏝️`, `Jalan ke Bali`, target
   `10.000.000`, sisihkan `1.000.000`

| Periksa | Yang diharapkan |
|---|---|
| Kartu wishlist | Progress `0%`, "kurang Rp10.000.000" |
| Kelola Kantong → belum dialokasikan | **Berkurang Rp1.000.000** |

**Gagal bila tidak berubah** — berarti `/budget/summary` belum mengurangi alokasi
wishlist, dan aplikasi memberi tahu ada uang bebas yang sudah dijanjikan.

#### C2. Menyetor

| Langkah | Yang diharapkan |
|---|---|
| **Setor** `3.000.000` | Progress **30%** |
| Kartu | Ada perkiraan selesai, mis. "7 bulan lagi" |
| **Riwayat Transaksi** | **Tidak ada** pengeluaran baru |
| Grafik tren | Garis pengeluaran **tidak naik** |

**Gagal bila setoran muncul sebagai pengeluaran.**

#### C3. Menarik

| Langkah | Yang diharapkan |
|---|---|
| Setor → tab **Tarik** → `1.000.000` | Terkumpul Rp2.000.000, progress `20%` |
| Tarik melebihi terkumpul | "Penarikan melebihi jumlah yang terkumpul." |

#### C4. Target tercapai

| Periksa | Yang diharapkan |
|---|---|
| Badge | **"Tercapai"** |
| Progress bar | Penuh, warna sukses — **bukan** merah |
| Kelola Kantong | Alokasi berhenti memotong budget |
| Kartu | Tetap ada, tidak hilang sendiri |

### D. Penjaga Solvabilitas

#### D1. Ketiga zona

| Kondisi | Zona | Tampilan |
|---|---|---|
| Komitmen jauh di bawah uang tersedia | 🟢 | "Komitmen bulan ini aman" |
| Menyisakan < 10% uang tersedia | 🟡 | "Uang cukup, tapi tipis" |
| Komitmen melebihi uang tersedia | 🔴 | "Uangmu kurang…" + nominal kurangnya |

Cara tercepat memicu merah: buat tagihan bernominal lebih besar dari sisa gaji.

#### D2. Gaji belum dialokasikan harus ikut dihitung

1. Pastikan ada gaji yang belum masuk kantong (mis. kantong total 60% saja)
2. Buat tagihan yang **melebihi sisa kantong** tapi **masih di bawah sisa kantong +
   gaji belum dialokasikan**

Zona harus **hijau atau kuning**, bukan merah. **Gagal bila merah** — berarti
rumusnya kembali membuang gaji yang belum dialokasikan.

#### D3. Kuning tidak boleh mengirim notifikasi

Masuk zona kuning. Tidak boleh ada toast maupun pesan WhatsApp — kuning hanya
mengubah warna bar.

### E. Tampilan di halaman lain

#### E1. Kartu "Alokasi Lain"

| Periksa | Yang diharapkan |
|---|---|
| Kartu muncul | Hanya bila ada wishlist beralokasi atau tagihan tanpa kantong |
| Isinya | Wishlist + tagihan yang kategorinya **belum punya kantong** |

**Uji dobel hitung — wajib.** Buat tagihan `Kos` dengan kategori yang **sudah**
punya kantong. Kos **tidak boleh** muncul di kartu Alokasi Lain. Kalau muncul,
uangnya terhitung dua kali dan total alokasi melebihi gaji.

#### E2. Baris zona di kartu utama

Di bawah **Sisa Gaji Pokok**: "Sisa aman Rp… setelah komitmen", atau saat merah
"Kurang Rp… untuk menutup komitmen bulan ini".

#### E3. Kartu "Tagihan Mendatang" di Dashboard

| Periksa | Yang diharapkan |
|---|---|
| Posisi | Kolom kanan, **di atas** System Updates |
| Isi | Maksimal **3** tagihan terdekat, **hanya tagihan** |
| Saat zona merah | Border memerah + baris peringatan |
| Tanpa tagihan terbuka | "Tidak ada tagihan yang perlu dibayar dalam waktu dekat." |

### F. Lintas tema dan layar

| Periksa | Yang diharapkan |
|---|---|
| Bar solvabilitas ketiga zona | Terbaca di Light, Dark, Factory, Spidey |
| Progress bar wishlist | Terlihat di keempat tema |
| Lebar 375px | Tidak ada yang terpotong |
| Buku Panduan | Tombolnya ada di halaman Rencana Keuangan |

---

## 6. Jangan dilaporkan sebagai bug

Belum dibangun, bukan rusak:

| Belum ada | Fase |
|---|---|
| Pengingat WhatsApp otomatis | 8 |
| Perintah bot `!bills`, `!paid`, `!skip`, `!goals`, `!nabung` | 8 |
| Setoran otomatis awal siklus | 8 |
| Peringatan merah otomatis setelah mencatat transaksi | 8 |
| Simpan/terapkan template kantong di UI | 0d sisa |
| `totalSaved` terisi di rekap bulanan | 9 |
| Komitmen masuk konteks AI | 9 |
| Frekuensi mingguan | ditolak sengaja, lihat §3 butir 7 |
