# Rencana Implementasi — Tabungan Masa Depan & Tagihan Mendatang

**Status:** rancangan, belum dikerjakan · **Branch:** `feat/upcoming-bills-saving-goals`
**Disusun:** 30 Agustus 2026 · **Revisi 2:** konsep wishlist, cicilan bertenor, dan penjaga solvabilitas

Dokumen ini merancang dua fitur sekaligus karena keduanya menjawab satu pertanyaan
pengguna yang sama: **"uang saya sudah dijanjikan ke mana?"** Kantong Keuangan
menjawab *"boleh habis berapa"*; dua fitur ini menjawab *"berapa yang sebenarnya
sudah bukan milik saya lagi"*.

Menggantikan ide roadmap butir 1 & 2 di `Kainest/AGENTS.md`.

---

## 1. Keputusan utama, di depan

| Pertanyaan | Keputusan | Alasan singkat |
|---|---|---|
| Tabungan = jenis kantong baru? | **Tidak.** Model sendiri `SavingGoal` | Roadmap lama mengusulkan "Kantong Tabungan", tapi `BudgetPocket` punya `@@unique([userId, categoryId])` — satu kantong per kategori. Kalau target jadi kantong, user hanya bisa punya **satu** wishlist |
| Alokasi bulanan tabungan memotong budget? | **Ya, otomatis di awal siklus** | Ini permintaan eksplisit: "1 jutanya nanti akan terhitung jadi pengurangan budget di bulan itu" |
| Setoran tabungan bikin `Transaction`? | **Tidak** | Tabungan adalah pemindahan, bukan konsumsi. Kalau dicatat sebagai EXPENSE, ia mencemari `totalSpent`, grafik tren, `!monthly`, dan evaluasi AI |
| Bayar tagihan bikin `Transaction`? | **Ya, tapi hanya kalau pengguna mengonfirmasi** | "dibayar maka akan masuk ke pengeluaran tapi jika tidak maka tidak akan dikurangi" |
| Tagihan bisa bertenor (cicilan)? | **Ya** — `totalInstallments` | Cicilan 12× Rp500rb berhenti sendiri setelah lunas 12× |
| Halaman baru atau section? | **Keduanya** — 1 halaman baru + 2 section | Lihat §6 |
| Slice fitur baru atau masuk `budgeting`? | **Slice baru** `plans` | `budgeting` sudah 30 berkas di BE. Fitur ini bawa 5 model, ~16 use case, 1 cron, dan 5 perintah bot sendiri |

**Asimetri yang perlu dipegang sepanjang implementasi:**
tagihan **menghasilkan** transaksi, tabungan **tidak**. Itu bukan detail teknis —
itu perbedaan antara uang yang habis dan uang yang pindah tempat. Keduanya sama-sama
memotong budget, tapi hanya satu yang boleh muncul di grafik pengeluaran.

---

## 2. Proses bisnis — Tabungan (Wishlist)

### 2.1 Bentuknya

Pengguna membuat **wishlist**, bukan "rekening tabungan":

```
🏝️  Jalan ke Bali
     Target       Rp 10.000.000
     Per bulan    Rp  1.000.000
     Terkumpul    Rp  3.000.000   ███████░░░░░░░░░░░░░  30%
     Perkiraan selesai: Mei 2027 (7 bulan lagi)
```

Persentase itu bukan hiasan — ia satu-satunya alasan orang bertahan menabung 10 bulan.

### 2.2 Alur

```
Pengguna membuat wishlist
  nama ("Jalan ke Bali"), target Rp10.000.000, per bulan Rp1.000.000
        │
        ▼
Rp1.000.000 langsung MEMOTONG budget siklus berjalan
  gaji Rp6.000.000 → yang boleh dipakai tinggal Rp5.000.000
        │
        ▼
Setiap siklus baru dimulai (payday), cron membuat SavingContribution
otomatis sebesar alokasi bulanan → progress bar bergerak sendiri
        │
        ├─► Pengguna butuh uangnya   ──►  "Tarik" → kontribusi negatif,
        │                                  budget siklus itu kembali naik
        │
        ├─► Pengguna ingin nabung ekstra ──► setor manual di web
        │                                     atau `!nabung 500rb bali`
        │
        └─► Terkumpul ≥ target       ──►  status ACHIEVED, alokasi bulanan
                                          berhenti memotong budget
```

### 2.3 Kenapa otomatis, dan risikonya

Permintaannya jelas: alokasi bulanan **memotong budget bulan itu**. Model mentalnya
amplop — gaji Rp6 juta, Rp1 juta disisihkan untuk Bali, yang boleh dipakai Rp5 juta.
Itu persis cara `BudgetPocket` bekerja, dan konsisten dengan aplikasinya.

**Risikonya harus disebut**: progress bar bergerak otomatis walaupun pengguna
sebenarnya tidak benar-benar menyisihkan uangnya. Aplikasi bisa bilang "Bali sudah
30%" padahal uangnya sudah terpakai.

**Penanganannya**: dua hal, bukan satu.

1. **Setoran otomatis ditandai `source: AUTO_CYCLE`** dan bisa ditarik kapan saja.
   Riwayat jujur — terlihat mana yang otomatis, mana yang disetor sadar.
2. **Kalau siklus berakhir dengan sisa budget negatif**, setoran otomatis siklus itu
   **tidak dibuat**, dan pengguna diberi tahu: *"Bulan ini pengeluaran melebihi
   budget, jadi setoran Bali Rp1.000.000 dilewati. Progress tetap di 30%."*
   Ini menjaga progress bar tetap berarti tanpa memaksa pengguna mencatat manual.

### 2.4 Aturan lain

1. **Menarik bukan menghapus.** Penarikan = `SavingContribution` bernilai negatif,
   supaya riwayatnya jujur.
2. **Target tercapai tidak otomatis hilang.** Status `ACHIEVED`, alokasi berhenti
   memotong budget, pengguna sendiri yang mengarsipkan.
3. **Tidak ada kejutan untuk kondisi gagal.** Target meleset dari tenggat tidak dapat
   animasi/GIF — lihat aturan momen kejutan di `KAINEST_DESIGN.md`.
4. **Wishlist tanpa alokasi bulanan boleh.** Sekadar mencatat keinginan, tidak
   memotong budget, progress hanya bergerak saat setor manual.

---

## 3. Proses bisnis — Tagihan & Cicilan

### 3.1 Tiga bentuk yang harus didukung

| Bentuk | Contoh | Model |
|---|---|---|
| **Berulang tanpa akhir** | Kos, listrik, langganan | `MONTHLY`, `totalInstallments = null` |
| **Cicilan bertenor** | Motor 12× Rp850rb | `MONTHLY`, `totalInstallments = 12` |
| **Sekali bayar** | Pajak kendaraan, servis | `ONE_TIME` |

Cicilan bertenor **berhenti menagih sendiri** setelah angsuran ke-12 lunas — statusnya
jadi `COMPLETED`. Tanpa ini, pengguna harus ingat menonaktifkannya sendiri, dan tidak
akan ingat.

### 3.2 Alur

```
Pengguna mendaftarkan tagihan
  nama, nominal, kategori (kantong mana yang kena),
  tanggal jatuh tempo, frekuensi, tenor (opsional), H-berapa diingatkan
        │
        ▼
Sistem memetakan jatuh tempo ke SIKLUS PAYDAY, bukan bulan kalender
        │
        ▼
Cron harian 07:00 WIB memeriksa tagihan jatuh tempo dalam
`reminderDaysBefore` hari yang belum lunas siklus ini
        │
        ▼
"🔔 Kos Rp1.100.000 jatuh tempo 7 hari lagi (2 Sep)"
        │
        ├─► `!paid kos` / klik "Tandai Lunas"
        │        ▼
        │   Transaction (EXPENSE) + BillPayment
        │   → limit kantong terpotong, angsuran bertambah 1
        │
        ├─► `!skip kos` / "Lewati bulan ini"
        │        ▼
        │   BillPayment status SKIPPED, TANPA transaksi
        │   → budget tidak berkurang sama sekali
        │
        └─► Tidak ditindak sampai lewat jatuh tempo
                 ▼
            status OVERDUE, tetap ditagih, tetap dihitung
            sebagai komitmen yang belum tertutup
```

**Tidak ada pencatatan otomatis.** Permintaannya eksplisit: pengeluaran hanya
tercatat kalau pengguna bilang sudah bayar. Rancangan sebelumnya punya opsi
`autoRecord` — **dihapus**, karena bertentangan dengan ini dan tidak ada yang
memintanya.

### 3.3 Aturan lain

1. **Satu tagihan lunas sekali per siklus.** Dijamin `@@unique([billId, period])`.
2. **Nominal boleh dikoreksi saat melunasi.** Listrik didaftarkan Rp350.000, tagihan
   asli Rp412.000 → yang tercatat Rp412.000, perkiraan tetap Rp350.000.
3. **Melewatkan bukan melunasi.** `SKIPPED` untuk "bulan ini dibayar orang tua".
4. **Pelunasan bisa dibatalkan.** Salah tandai → transaksi terkait ikut terhapus.

---

## 4. Penjaga Solvabilitas — inti dari kedua fitur

Ini bagian yang membuat dua fitur di atas layak dibangun. Tanpa ini, keduanya cuma
daftar yang enak dilihat.

### 4.1 Satu angka yang menentukan segalanya

Rumusnya harus menghitung **seluruh** uang yang masih bisa dipakai, bukan hanya sisa
kantong. Dari `GetMonthlySummaryUseCase.ts`:

- `totalRemaining = totalLimit − totalSpent` → sisa **di dalam** kantong yang belum
  terpakai. Kantong Makan Rp2jt baru terpakai Rp1,2jt? Rp800rb itu uang nyata.
- `unallocated = salary − totalLimit` → gaji yang belum dialokasikan ke kantong
  mana pun. Juga uang nyata.

```
uangTersedia    = totalRemaining + unallocated
komitmenTersisa = tagihanBelumLunasSiklusIni + alokasiTabunganBelumTersetor
sisaAman        = uangTersedia − komitmenTersisa
```

**Rumus lama hanya memakai `totalRemaining`** dan membuang `unallocated` — itu
bukan sekadar terlalu ketat, itu keliru. Gaji yang belum dialokasikan tetap ada di
rekening dan tetap bisa dipakai membayar tagihan.

**Kenapa tidak dobel hitung.** Tagihan Kos Rp1,1jt yang punya kantong Kos Rp1,1jt
belum terpakai: uang itu ada di `totalRemaining`, lalu dikurangi lagi sebagai
komitmen → hasilnya nol untuk bagian itu. Benar, karena setelah dibayar kantong Kos
memang jadi nol. Tagihan yang kategorinya **tidak punya kantong** tidak masuk
`totalLimit`, jadi uangnya diambil dari `unallocated` — dan rumus yang sama tetap
bekerja. Satu rumus menangani keduanya.

| Zona | Syarat | Arti bagi pengguna | Kirim notifikasi? |
|---|---|---|---|
| 🟢 **Aman** | `sisaAman ≥ 10%` dari `uangTersedia` | Boleh belanja santai | Tidak |
| 🟡 **Waspada** | `0 ≤ sisaAman < 10%` | Uang cukup, tapi tipis | **Tidak — hanya tampil di UI** |
| 🔴 **Bahaya** | `sisaAman < 0` | **Uang tidak akan cukup untuk tagihan bulan ini** | Ya |

**Hanya zona merah yang mengirim pesan.** Zona kuning cukup terlihat di aplikasi.
Ini yang menjaga fiturnya tidak berubah jadi bot cerewet: pengguna hanya diganggu
kalau uangnya benar-benar tidak akan cukup — bukan setiap kali angkanya menipis.

Ambang 10% (turun dari 20% di revisi sebelumnya) memakai konsep zona yang sudah
dirancang di `Finance Tech.md` §4.1 untuk kantong makan — istilah yang sama, supaya
pengguna tidak belajar dua bahasa.

### 4.2 Kapan diperiksa

Bukan hanya lewat cron. Diperiksa **setiap kali uang bergerak**:

| Pemicu | Reaksi |
|---|---|
| Transaksi baru dicatat (web **atau** bot) | Kalau zona **jatuh ke merah**, bot langsung menyusulkan peringatan setelah balasan "Siap Noted" |
| Tagihan baru didaftarkan | Kalau langsung membuat zona merah, tolak diam-diam? **Tidak** — tetap disimpan, tapi peringatkan saat itu juga |
| Alokasi tabungan diubah | Sama seperti di atas |
| Gaji diubah | Sama |
| Cron harian 07:00 WIB | Jaring pengaman kalau semua pemicu di atas terlewat |

Zona kuning **tidak** memicu apa pun di daftar ini. Ia hanya mengubah warna bar di
UI. Yang mengirim pesan hanya transisi **ke merah**.

### 4.3 Bentuk peringatannya

Zona merah, lewat WhatsApp:

```
🔴 Uangmu kurang untuk tagihan bulan ini

Sisa budget       Rp 1.200.000
Tagihan belum bayar Rp 1.750.000
                  ──────────────
Kurang            Rp   550.000

Yang belum dibayar:
• Kos       Rp 1.100.000  — 5 hari lagi
• Internet  Rp   300.000  — 12 hari lagi
• Motor     Rp   350.000  — 18 hari lagi (angsuran 4/12)

Ketik !bills untuk detail.
```

Zona kuning lebih ringan, satu kalimat, tanpa rincian.

### 4.4 Anti-spam — ini yang menentukan fiturnya berguna atau dimatikan

Peringatan yang datang tiap hari akan diabaikan dalam seminggu, lalu botnya dibisukan.

Tiga lapis pengaman, dari yang paling kasar:

1. **Zona kuning tidak pernah mengirim pesan.** Ini yang paling banyak memangkas
   kebisingan, karena kuning jauh lebih sering terjadi daripada merah.
2. **Satu peringatan merah per siklus.** Dijaga `CommitmentAlert` dengan
   `@@unique([userId, period, zone])`.
3. **Dikirim ulang hanya kalau ada kejadian baru** — pengguna sempat kembali ke
   hijau/kuning lalu jatuh lagi ke merah. Bukan kondisi sama yang diulang tiap pagi.

### 4.5 Pendapat: "jangan terlalu boros" sebaiknya tidak jadi pengingat terpisah

Permintaannya menyebut dua hal berbeda: pengingat jatuh tempo, dan pengingat jangan
boros. Yang kedua **sebaiknya dilebur ke penjaga solvabilitas ini**, bukan dibuat
sebagai pengingat sendiri. Alasannya:

- "Boros" tanpa acuan hanyalah opini. "Boros" dengan acuan tagihan yang belum dibayar
  adalah fakta yang bisa ditindak. Zona kuning **sudah** berarti "kamu mulai boros",
  hanya saja ia bisa menyebutkan **kenapa** dan **berapa**.
- Dua sumber peringatan yang mengurusi hal mirip akan saling menimpa. Pengguna
  menerima dua pesan dalam sehari tentang uang yang sama, lalu berhenti membaca
  keduanya.
- `Finance Tech.md` sudah merancang zona harian untuk kantong makan tapi belum
  dibangun. Membangun zona yang berbasis komitmen sekaligus menutup rancangan lama itu
  dengan satu mekanisme, bukan dua.

Kalau nanti tetap diinginkan peringatan boros yang berdiri sendiri (misal "makan
minggu ini naik 20% dari biasanya"), itu masuk ke roadmap **AI Insight** — sudah ada
sebagai butir 3 di `AGENTS.md`, dan tempatnya memang di sana.

---

## 5. Rancangan data (Prisma)

Semua model masuk skema `kainest`. **Perlu `VIEW` di skema `public`** untuk tabel yang
dibaca bot lewat PostgREST — lihat catatan 13 Juni 2026 di `AGENTS.md`.

```prisma
enum BillFrequency {
  MONTHLY
  WEEKLY
  YEARLY
  ONE_TIME
  @@schema("kainest")
}

enum BillStatus {
  ACTIVE
  COMPLETED   // tenor cicilan habis
  ARCHIVED
  @@schema("kainest")
}

enum BillPaymentStatus {
  PAID
  SKIPPED
  @@schema("kainest")
}

enum SavingGoalStatus {
  ACTIVE
  ACHIEVED
  ARCHIVED
  @@schema("kainest")
}

enum ContributionSource {
  AUTO_CYCLE   // dibuat cron di awal siklus dari monthlyAllocation
  MANUAL       // disetor sadar oleh pengguna
  WITHDRAWAL   // penarikan (amount negatif)
  @@schema("kainest")
}

enum CommitmentZone {
  SAFE
  WARNING
  DANGER
  @@schema("kainest")
}

/// Tagihan berulang & cicilan bertenor.
model RecurringBill {
  id                 String        @id @default(uuid())
  userId             String
  categoryId         String
  name               String
  amount             Int           // perkiraan; boleh dikoreksi saat melunasi
  frequency          BillFrequency @default(MONTHLY)
  dueDay             Int           // 1-31
  dueMonth           Int?          // 1-12, hanya untuk YEARLY
  startDate          DateTime      @db.Date

  /// Tenor cicilan. null = berulang tanpa akhir (kos, listrik).
  totalInstallments  Int?
  /// Bertambah setiap BillPayment berstatus PAID. Mencapai tenor -> COMPLETED.
  paidInstallments   Int           @default(0)

  reminderDaysBefore Int           @default(3)
  status             BillStatus    @default(ACTIVE)
  note               String?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  user     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  category BudgetCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  payments BillPayment[]

  @@index([userId, status])
  @@index([userId, dueDay])
  @@schema("kainest")
}

/// Satu baris per tagihan per siklus. Mencegah tagihan sama lunas dua kali.
model BillPayment {
  id            String            @id @default(uuid())
  billId        String
  userId        String
  period        DateTime          @db.Date  // kunci sama dengan MonthlyFinancialHistory.period
  status        BillPaymentStatus @default(PAID)
  installmentNo Int?                        // angsuran ke-berapa; null jika tanpa tenor
  paidAmount    Int?                        // null jika SKIPPED
  transactionId String?           @unique   // null jika SKIPPED
  paidAt        DateTime          @default(now())

  bill        RecurringBill @relation(fields: [billId], references: [id], onDelete: Cascade)
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transaction Transaction?  @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@unique([billId, period])
  @@index([userId, period])
  @@schema("kainest")
}

/// Wishlist. BUKAN BudgetPocket — pocket dibatasi satu per kategori.
model SavingGoal {
  id                String           @id @default(uuid())
  userId            String
  name              String                        // "Jalan ke Bali"
  targetAmount      Int                           // 10_000_000
  monthlyAllocation Int              @default(0)  // 1_000_000; memotong budget siklus
  targetDate        DateTime?        @db.Date
  icon              String?                       // emoji, mis. "🏝️"
  status            SavingGoalStatus @default(ACTIVE)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  user          User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  contributions SavingContribution[]

  @@index([userId, status])
  @@schema("kainest")
}

/// Setoran. Nominal negatif = penarikan (riwayat tetap jujur).
model SavingContribution {
  id        String             @id @default(uuid())
  goalId    String
  userId    String
  amount    Int
  source    ContributionSource @default(MANUAL)
  note      String?
  date      DateTime
  period    DateTime           @db.Date
  createdAt DateTime           @default(now())

  goal SavingGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)
  user User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// Setoran otomatis hanya boleh sekali per siklus per wishlist.
  @@unique([goalId, period, source])
  @@index([userId, period])
  @@index([goalId, date])
  @@schema("kainest")
}

/// Penjaga anti-spam. Satu peringatan per zona per siklus.
model CommitmentAlert {
  id        String         @id @default(uuid())
  userId    String
  period    DateTime       @db.Date
  zone      CommitmentZone
  shortfall Int            @default(0)  // seberapa kurang saat DANGER
  sentAt    DateTime       @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, period, zone])
  @@index([userId, period])
  @@schema("kainest")
}
```

Tambahan relasi di model yang sudah ada:

```prisma
model User {
  // ...
  recurringBills      RecurringBill[]
  billPayments        BillPayment[]
  savingGoals         SavingGoal[]
  savingContributions SavingContribution[]
  commitmentAlerts    CommitmentAlert[]
}

model BudgetCategory {
  // ...
  recurringBills RecurringBill[]
}

model Transaction {
  // ...
  billPayment BillPayment?
}

model MonthlyFinancialHistory {
  // ...
  /// Snapshot komitmen (tagihan & wishlist) pada siklus ini. Nullable agar
  /// baris riwayat lama tetap valid tanpa backfill.
  commitmentsSnapshot Json?
}
```

**`MonthlyFinancialHistory.totalSaved` akhirnya terpakai** — diisi dari jumlah
`SavingContribution` pada `period` bersangkutan saat `syncMonthlyHistory` berjalan.

---

## 6. Rancangan API

Route baru `app.route("/plans", plansRoute)` di `src/app.ts`, dengan `authMiddleware`.

### Tagihan

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/plans/bills` | Daftar + status siklus (`upcoming`/`overdue`/`paid`/`skipped`) + progres angsuran |
| `GET` | `/plans/bills/upcoming?days=7` | Ringkas, untuk widget dashboard dan bot |
| `POST` | `/plans/bills` | Buat |
| `PUT` | `/plans/bills/:id` | Ubah |
| `DELETE` | `/plans/bills/:id` | Hapus |
| `POST` | `/plans/bills/:id/pay` | `{ amount?, date? }` → `Transaction` + `BillPayment`, angsuran +1 |
| `POST` | `/plans/bills/:id/skip` | `BillPayment` tanpa transaksi |
| `DELETE` | `/plans/bills/:id/payment` | Batalkan pelunasan siklus ini |

### Tabungan

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/plans/goals` | Daftar + terkumpul, **persentase**, sisa, laju, proyeksi selesai |
| `POST` | `/plans/goals` | Buat |
| `PUT` | `/plans/goals/:id` | Ubah |
| `DELETE` | `/plans/goals/:id` | Hapus |
| `POST` | `/plans/goals/:id/contribute` | `{ amount, note?, date? }`. Negatif = tarik |
| `GET` | `/plans/goals/:id/contributions` | Riwayat setoran |
| `PATCH` | `/plans/goals/:id/status` | `ACHIEVED` / `ARCHIVED` |

### Solvabilitas

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/plans/health` | `{ zone, sisaBudget, tagihanBelumLunas, alokasiTabungan, sisaAman, shortfall, bills[] }` |

### Endpoint yang berubah

| Endpoint | Perubahan | Kenapa wajib |
|---|---|---|
| `GET /budget/summary` | `totals.unallocated` dikurangi alokasi wishlist aktif. Tambah `totals.committed` dan `totals.safeRemaining` + `zone` | **Tanpa ini aplikasi berbohong** — memberi tahu ada uang bebas yang sudah dijanjikan |
| `POST /budget/transactions` | Setelah sukses, evaluasi zona. Kalau turun, kirim peringatan | Inilah "langsung ingatkan usernya" |

---

## 7. Rancangan halaman — halaman baru atau section?

### Jawaban: satu halaman baru + dua section, bukan salah satunya

**Satu halaman baru `/app/plans` — "Rencana Keuangan"**, memakai primitif `Tabs`
dari `src/ui/` dengan dua tab: **Tabungan** dan **Tagihan**.

Kenapa satu halaman, bukan dua:

- Grup **Keuangan** di sidebar sudah punya 4 entri (Kantong Keuangan, Riwayat
  Transaksi, Rekap Bulanan, Split Bill AI). Menambah dua lagi jadi enam — grup
  terpanjang di aplikasi, dan dua di antaranya jarang dibuka harian.
- Keduanya menjawab pertanyaan yang sama, jadi memisahkannya memaksa pengguna
  membuka dua halaman untuk satu pertanyaan.
- `Tabs` sudah ada di lapis primitif, tidak perlu komponen baru.

Kenapa tidak digabung saja ke `BudgetDashboardPage`:

- Halaman itu sudah memuat banner AI, hero card, grafik tren, rincian kantong, dan
  **tiga modal**. Menambah CRUD dua fitur lagi menjadikannya tempat pembuangan.
- CRUD tagihan dan wishlist bukan aktivitas harian. Yang harian adalah **melihat
  statusnya** — dan itulah yang jadi section.

**Di atas kedua tab**, satu bar solvabilitas yang selalu terlihat:

```
🟡 Waspada — sisa aman Rp 340.000 dari sisa budget Rp 1.200.000
```

### Dua section yang ditambahkan

**a) `BudgetDashboardPage` (Kantong Keuangan) — kartu "Alokasi Lain" di Rincian Kantong**

Bukan strip terpisah, melainkan **satu kartu tambahan di dalam grid Rincian Kantong**
yang sudah ada, berdampingan dengan kantong-kantong biasa.

Ini lebih baik daripada strip terpisah karena pengguna sudah punya satu tempat untuk
menjawab "uang saya dialokasikan ke mana" — yaitu Rincian Kantong. Komitmen adalah
alokasi, jadi tempatnya memang di sana. Strip terpisah akan membuat pertanyaan yang
sama punya dua jawaban di halaman yang sama.

**Isinya: komitmen yang TIDAK punya kantong sendiri.** Ini definisi yang harus
dipegang, kalau tidak angkanya dobel:

| Komitmen | Muncul di mana |
|---|---|
| Alokasi wishlist (tidak punya kategori) | **Alokasi Lain** |
| Tagihan yang kategorinya belum punya kantong | **Alokasi Lain** |
| Tagihan yang kategorinya **sudah** punya kantong (mis. Kos) | Di kartu kantong Kos, sebagai baris konteks — **bukan** di Alokasi Lain |

Kartu kantong biasa ikut mendapat satu baris konteks, sehingga limitnya berhenti
terasa seperti angka kosong:

```
🏠 Kos                          🏝️ Alokasi Lain
Rp 1.100.000                    Rp 1.300.000
████████████████████ 0%         ▓▓▓▓▓░░░░░ tersetor 23%
Terpakai Rp 0                   ── Wishlist ──────────────
                                🏝️ Jalan ke Bali   Rp 1.000.000
🔔 Tagihan Kos jatuh tempo         3.000.000/10.000.000 · 30%
   5 hari lagi                  ── Tagihan ───────────────
                                🛵 Motor (4/12)      Rp 350.000
                                   18 hari lagi
```

**Tampilannya sengaja berbeda** dari kantong biasa, karena maknanya berbeda: kantong
biasa mengukur *seberapa banyak sudah dihabiskan*, kartu ini mengukur *seberapa
banyak sudah ditunaikan*. Progress bar kantong biasa penuh = bahaya; di kartu ini
penuh = bagus. Warnanya karena itu tidak boleh mengikuti `status-danger` saat mendekati
penuh.

**Kartu ini virtual, bukan `BudgetPocket` sungguhan.** Alasannya tiga: `BudgetPocket`
wajib punya `categoryId` sementara komitmen menyeberangi banyak kategori; kalau jadi
baris nyata pengguna bisa menghapusnya lewat Kelola Kantong dan merusak fitur; dan
`@@unique([userId, categoryId])` akan bentrok dengan kantong kategori yang sama.

**Zona solvabilitas ditempelkan ke `BudgetHeroCard`**, bukan jadi elemen sendiri —
satu baris di bawah angka sisa uang, karena zona itu memang keterangan atas angka itu:

```
Sisa Bulan Ini
Rp 2.400.000
🟡 Sisa aman Rp 340.000 setelah komitmen
```

**b) `Dashboard.vue` (Dashboard utama) — kartu "Tagihan Mendatang"**

Kolom kanan, **di atas `DashboardSystemUpdates`**. Maksimal 3 baris.

**Hanya tagihan, tanpa wishlist.** Tagihan punya tenggat — melewatkannya ada
akibatnya. Wishlist tidak mendesak, dan menaruhnya di sini membuat kartu ini berhenti
berarti "ada yang perlu ditindak". Saat zona merah, kartu ini yang berubah warna.

### Yang tidak berubah

`BudgetSetupModal` dan `PocketManagementModal` **tidak disentuh**. Alokasi wishlist
diatur di halaman Rencana, bukan dicampur ke alur pengaturan gaji — alur itu baru
saja disederhanakan (13 Juni 2026).

### Ringkasan berkas frontend

```
src/features/plans/                    ← slice vertikal baru
├── data/
│   ├── source/PlansRemoteSource.js    ← lewat apiClient, WAJIB
│   ├── mappers/PlansMapper.js
│   └── repository/PlansRepository.js  ← try/catch → Either
├── domain/
│   ├── entities/{BillEntity,SavingGoalEntity,CommitmentHealthEntity}.js
│   ├── repository/IPlansRepository.js
│   └── use-cases/                     ← ~16 berkas
└── presentation/
    ├── stores/usePlansStore.js        ← kontrak Either, BUKAN try/catch
    ├── pages/PlansPage.vue
    └── components/
        ├── SolvencyBar.vue            ← zona hijau/kuning/merah, dipakai PlansPage
        ├── BillList.vue · BillFormModal.vue · BillPayModal.vue
        ├── SavingGoalCard.vue · SavingGoalFormModal.vue · ContributeModal.vue
        └── OtherAllocationCard.vue    ← kartu "Alokasi Lain" di Rincian Kantong

src/partials/dashboard/DashboardUpcomingBills.vue   ← kartu Dashboard utama
```

Perubahan berkas yang sudah ada:

| Berkas | Perubahan |
|---|---|
| `router.js` | 1 rute `/app/plans` |
| `Sidebar.vue` | 1 entri menu, `requiredPermission: "budgeting"` |
| `core/di/di.js` | ~16 pendaftaran use case |
| `config/pageGuides.js` | 1 kunci `plans` → total 14 |
| `ui/icons.js` | `IconSavings`, `IconClock`, `IconCalendar` sudah ada; mungkin perlu `IconFlag` |
| `BudgetDashboardPage.vue` | Sisipkan `<OtherAllocationCard>` di grid Rincian Kantong |
| `BudgetHeroCard.vue` | 1 baris zona solvabilitas di bawah angka sisa |
| `BudgetCategoryCard.vue` | 1 baris konteks tagihan bila kategorinya punya tagihan aktif |

---

## 8. Perintah bot baru

| Perintah | Fungsi |
|---|---|
| `!bills` | Daftar tagihan siklus ini + status + zona solvabilitas |
| `!paid <nama>` | Tandai lunas, buat transaksi |
| `!skip <nama>` | Lewati bulan ini tanpa transaksi |
| `!goals` | Progress semua wishlist dengan persentase |
| `!nabung <nominal> <nama>` | Setor manual ke wishlist |

`!help` diperbarui. Universal Help Footer tetap dipasang di semua balasan.

---

## 9. Rencana implementasi bertahap

Setiap fase berdiri sendiri dan bisa dipakai.

| Fase | Isi | Selesai berarti |
|---|---|---|
| **0. Perbaikan & Kelola Kantong** | Notifikasi dobel, kartu baru di atas, sisa persentase, template kantong — **rinciannya di §12** | Satu toast per galat; template bisa disimpan & dipakai ulang |
| **1. Skema** | 6 model + 6 enum + relasi + `commitmentsSnapshot`. Migrasi (sekalian `PocketTemplate`). `VIEW` di `public` | `prisma migrate dev` hijau, `npm run test` hijau |
| **2. Tagihan — backend** | Repository, 8 use case, controller, route. Pemetaan `dueDay` → siklus lewat `getCycleBoundaries`. Logika tenor & `COMPLETED` | cURL: buat cicilan 12× → lunasi 1× → angsuran jadi 1/12, transaksi masuk kantong yang benar |
| **3. Tagihan — frontend** | Slice `plans`, `PlansPage` tab Tagihan, CRUD + tandai lunas/lewati | Bisa mengelola tagihan & cicilan penuh dari web |
| **4. Tabungan — backend** | Repository, 7 use case, route. Cron setoran otomatis awal siklus. **`GET /budget/summary` diperbaiki** | `unallocated` turun sesuai alokasi wishlist |
| **5. Tabungan — frontend** | Tab Tabungan, kartu wishlist + persentase + proyeksi, modal setor/tarik | Bisa mengelola wishlist penuh dari web |
| **6. Solvabilitas** | `GET /plans/health`, evaluasi zona setelah transaksi, `CommitmentAlert`, `SolvencyBar` | Zona berubah seketika setelah mencatat transaksi besar |
| **7. Section dashboard** | `OtherAllocationCard` di Rincian Kantong, baris zona di `BudgetHeroCard`, baris konteks di `BudgetCategoryCard`, `DashboardUpcomingBills` | Komitmen terlihat tanpa membuka halaman Rencana, dan tidak dobel hitung |
| **8. Pengingat & bot** | `BillReminderCron` harian 07:00 WIB lewat GOWA. 5 perintah bot. `!help` diperbarui | Pengingat terkirim di staging ke `STAGING_ALLOWED_NUMBERS` |
| **9. Integrasi AI** | `MonthlyResetCron` menyertakan komitmen dalam konteks reasoning. `totalSaved` terisi | Saran AI tidak menyarankan alokasi yang bentrok dengan cicilan berjalan |

**Fase 0–3 bisa dirilis lebih dulu.** Tagihan memberi manfaat lebih cepat daripada
wishlist karena punya konsekuensi waktu.

Urutan TDD sesuai `rules/common/testing.md` — tulis uji dulu untuk tiga tempat yang
paling mungkin salah dan paling mahal kalau salah:
1. Pemetaan `dueDay` → `period` lewat `getCycleBoundaries`
2. Perhitungan `sisaAman` dan penentuan zona
3. Penambahan angsuran & transisi ke `COMPLETED` saat tenor habis

---

## 10. Jebakan yang sudah diketahui

Diurut menurut biaya kalau terlewat.

1. **Jatuh tempo kalender vs siklus payday.** Tagihan jatuh tempo tanggal 5, payday
   tanggal 25 → tagihan itu masuk siklus yang **dimulai bulan sebelumnya**. Menyamakan
   `dueDay` dengan bulan kalender akan menaruh tagihan di siklus yang salah, dan
   `@@unique([billId, period])` menolak pelunasan yang sah. **Semua pemetaan wajib
   lewat `getCycleBoundaries`**, sama seperti bot dan `/budget/summary`.

2. **Dobel hitung di kartu "Alokasi Lain".** Tagihan yang kategorinya sudah punya
   kantong **tidak boleh** ikut dijumlahkan di kartu Alokasi Lain — uangnya sudah
   terwakili oleh limit kantong itu. Kalau ikut dijumlahkan, total alokasi di layar
   melebihi gaji dan pengguna akan mengira aplikasinya rusak. Aturannya satu kalimat:
   *Alokasi Lain hanya memuat komitmen yang tidak punya kantong sendiri.*

3. **`unallocated` yang berbohong.** Kalau alokasi wishlist tidak dikurangkan,
   dashboard memberi tahu ada uang bebas yang sudah dijanjikan. Bukan bug kosmetik —
   ini aplikasi keuangan yang salah memberi tahu saldo. Diperbaiki di BE
   (`GetMonthlySummaryUseCase`), **bukan** di store FE, karena `unallocated` datang
   dari `totals` API.

4. **Tabungan tidak boleh masuk `totalSpent`.** Kalau `SavingContribution` sempat
   dibuat sebagai `Transaction` EXPENSE, ia mencemari grafik tren, `!monthly`,
   `!balance`, dan evaluasi AI sekaligus. Sulit dilacak karena angkanya *terlihat*
   masuk akal.

5. **Setoran otomatis ganda.** Cron awal siklus bisa terpanggil dua kali (restart
   container, jam yang tumpang tindih). `@@unique([goalId, period, source])` adalah
   pengamannya — jangan dilepas demi kemudahan.

6. **Peringatan yang mengulang-ulang.** Tanpa `CommitmentAlert`, cron harian akan
   mengirim peringatan merah yang sama tiap pagi sampai botnya dibisukan.

7. **Total komitmen melebihi gaji.** Wishlist Rp1jt + cicilan Rp850rb + kos Rp1,1jt
   dari gaji Rp3jt sudah menyisakan sedikit sekali. Ini harus diberitahukan **saat
   mendaftarkan**, bukan di akhir bulan. Tetap disimpan — hak pengguna — tapi jangan
   diam-diam.

8. **Cicilan lunas harus berhenti menagih.** `paidInstallments` mencapai
   `totalInstallments` → status `COMPLETED`, hilang dari daftar mendatang dan dari
   perhitungan `sisaAman`.

9. **Rollover ke siklus baru.** `syncMonthlyHistory` pernah salah menghitung ulang
   persentase kantong (diperbaiki 2 Juli 2026). Tagihan `MONTHLY` harus muncul lagi
   di siklus baru **tanpa** menduplikasi `BillPayment` lama.

10. **Zona waktu.** Cron berjalan WIB. Perbandingan `dueDay` harus memakai zona yang
   sama, kalau tidak pengingat H-7 terkirim di H-6 atau H-8.

11. **Skema `kainest` vs `public`.** Bot membaca lewat PostgREST yang diarahkan ke
    `public`. Tabel baru yang dibaca bot **wajib** punya `VIEW` di `public` —
    pelajaran 13 Juni 2026.

12. **Kontrak error store.** `usePlansStore` **wajib** memakai `Either`. Saat ini hanya
    `useWaBotStore` dan `useGowaStore` yang memakai `try/catch` mentah, dan itu sudah
    terdaftar sebagai utang di `KAINEST_ARCHITECTURE.md`. Jangan menambah yang ketiga.

13. **Pagar desain.** 18 aturan `npm run lint:design` semuanya blocking. Komponen baru
    wajib memakai `src/ui/`, ikon lewat `@/ui/icons`, tanpa hex mentah, tanpa palet
    Tailwind statis. Zona hijau/kuning/merah memakai token `status-success`,
    `status-warning`, `status-danger` yang sudah ada — **jangan** membuat token baru,
    dan token wajib ada di keempat tema.

14. **Build hijau bukan bukti hidup.** Catatan 8–11 di `AGENTS.md`: buka aplikasinya,
    dan jalankan `npm run build && npm run preview` sebelum deploy.

---

## 11. Yang masih perlu diputuskan

1. ~~**"Beberapa kali setiap bulannya" — tenor atau banyak jatuh tempo?**~~
   **Terjawab 30 Agustus 2026:** yang dimaksud adalah **tenor cicilan**, dan
   **pengguna sendiri yang mengisi tanggal jatuh temponya**. Jadi satu `dueDay`
   yang berlaku untuk seluruh angsuran, diisi pengguna, bukan diturunkan dari
   `startDate`. `dueDays Int[]` tidak diperlukan.

2. **Tagihan & wishlist bersama pasangan.** Kos dibayar berdua, "Nikah 2027" ditabung
   berdua. *Usulan: milik satu pengguna dulu; menautkan ke `Couple` menyeret pertanyaan
   kantong siapa yang terpotong.*

3. **Buffer zona kuning 20%.** Angka ini tebakan berdasar zona kantong makan di
   `Finance Tech.md`. *Usulan: mulai 20%, jadikan konstanta bernama supaya mudah
   disetel setelah dipakai sebulan.*

4. **Kategori untuk penarikan tabungan.** Penarikan yang dipakai belanja idealnya
   tercatat. *Usulan: penarikan tanpa kategori di versi pertama; kalau dipakai belanja,
   pengguna mencatat transaksinya seperti biasa.*

5. **Nada pengingat.** Bot Kainest bernada santai, tapi pengingat tagihan menyentuh
   uang dan tenggat. *Usulan: hangat tanpa lelucon — sejalan dengan "momen buruk butuh
   empati, bukan lelucon" di `KAINEST_DESIGN.md`.*

---

## 12. Dikerjakan sekalian — perbaikan & enhancement Kelola Kantong

Ditambahkan 30 Agustus 2026 atas permintaan agar seluruhnya jalan dalam satu putaran.
Bukan bagian dari fitur Tabungan/Tagihan, tapi **menyentuh halaman yang sama** dan
punya satu titik singgung nyata (lihat §12.2c), jadi lebih murah dikerjakan bersama.

### 12.1 Bug — notifikasi dobel saat periode tutup buku

**Gejala.** Menambah transaksi ke periode yang sudah Tutup Buku Permanen memunculkan
**dua** toast sekaligus: satu kuning (warning) dan satu merah (error), dengan pesan
identik.

**Bukan karena request dobel.** Pemeriksaan Network menunjukkan satu `POST` (422) dan
satu `OPTIONS` (204). `OPTIONS` adalah preflight CORS bawaan browser karena permintaan
membawa header `authorization` dan `content-type` — normal, bukan percobaan kedua.

**Akar masalahnya: dua lapisan sama-sama memberi tahu pengguna.**

`useBudgetStore.js` baris 320–327 (`submitTransaction`):

```js
if (result.left?.code === 'TRANSACTION_CLOSED_PERIOD') {
  const modalStore = useModalStore();          // ← kode mati, tidak pernah dipakai
  notify.warning(result.left.message, ...);    // ← toast KUNING
  return { success: false, closedPeriod: true, message: result.left.message };
}
```

`TransactionForm.vue` baris 139–141:

```js
} else {
  notify.error(result.message || '...', result);  // ← toast MERAH, pesan sama
}
```

Store menampilkan peringatan lalu tetap mengembalikan `success: false`; form melihat
kegagalan itu dan menampilkan galat lagi. Bendera `closedPeriod: true` sudah
dikembalikan tapi **tidak pernah dibaca siapa pun**.

**Ada di dua tempat**, bukan satu: `submitTransaction` (baris 322) dan
`updateTransaction` (baris 346) — persis sama.

**Perbaikan.** Mekanismenya sudah ada. `notify.error(pesan, sumber)` melewati toast
kalau `sumber.__handled` bernilai true, dan `TransactionForm` sudah meneruskan
`result` sebagai `sumber`. Yang kurang hanya benderanya:

```js
return { success: false, closedPeriod: true, __handled: true, message: result.left.message };
```

Ditambah membuang baris `const modalStore = useModalStore();` yang mati di kedua
cabang, dan memperbaiki komentar di atasnya yang masih menulis "tampilkan modal
warning khusus" padahal modalnya sudah lama diganti toast.

Total: 2 baris diubah, 2 baris dihapus, 2 komentar dikoreksi.

**Kenapa warning-nya dipertahankan di store, bukan dipindah ke form.** Tutup Buku
Permanen adalah **aturan**, bukan kegagalan — nada yang tepat memang kuning, bukan
merah. Yang tahu bedanya cuma store, karena hanya store yang membaca
`result.left.code`. Form hanya tahu "gagal".

**Cegah berulang.** Pola "store memberi tahu, komponen memberi tahu lagi" akan tumbuh
lagi tanpa pagar. Tambahkan aturan lint ke-19 `no-double-notify`: menandai berkas
`.vue` yang memanggil `notify.error` atas hasil aksi store yang di dalamnya sudah
memanggil `notify.*`. Kalau deteksi statisnya terlalu rapuh, cukup dokumentasikan
kontraknya di `src/lib/notify.js`: **satu aksi = satu pemberi tahu**, dan yang berhak
adalah lapisan yang tahu paling banyak tentang penyebabnya.

### 12.2 Enhancement — modal Kelola Kantong

Empat permintaan. Yang penting: **dua di antaranya sudah setengah ada**, jadi ini
melanjutkan yang sudah dibangun, bukan menambah konsep sejajar.

#### a. Kartu kantong baru muncul di ATAS

Sekarang `addPocket()` memakai `.push()` — kartu baru masuk ke dasar daftar, di luar
layar, dan pengguna tidak tahu harus mengisi apa.

```js
// sebelum
pocketsData.value.push({ ... });
// sesudah
pocketsData.value.unshift({ ... });
```

Disertai `scrollContainer.value?.scrollTo({ top: 0, behavior: 'smooth' })` supaya
kartunya benar-benar terlihat, dan fokus otomatis ke pemilih kategori. Tanpa scroll,
pengguna yang sedang di tengah daftar tetap tidak melihat apa pun berubah.

#### b. Sisa persentase yang belum dialokasikan

`totalPercentage` **sudah ada** (baris 584) dan header sudah menampilkannya beserta
peringatan saat melebihi 100% (baris 25–29). Yang belum ada: **sisanya**.

"Total 77%" memberi tahu apa yang sudah terjadi. "Sisa 23% (Rp1.380.000)" memberi tahu
apa yang bisa dilakukan — dan itu yang dibutuhkan saat sedang mengisi.

```
Total dialokasikan     77%   Rp 4.620.000
Belum dialokasikan     23%   Rp 1.380.000     [ Alokasikan ke kantong baru ]
```

Nominal rupiah ikut ditampilkan karena persentase saja sulit dinilai — "23%" tidak
terasa apa-apa sampai terbaca sebagai Rp1.380.000.

#### c. Alokasikan sisa langsung ke kantong baru

Tombol pada kartu kosong: **"Pakai sisa 23%"**. Sekali klik, isi `percentage` dengan
sisa yang ada.

**Titik singgung dengan fitur Tabungan.** Alokasi wishlist juga memakan gaji
(§2.3). Jadi begitu §3 (Tabungan — backend) selesai, "belum dialokasikan" **wajib**
ikut mengurangi alokasi wishlist, kalau tidak modal ini akan menawarkan sisa 23%
yang sebenarnya sudah dijanjikan untuk Bali. Selama fitur Tabungan belum ada,
rumusnya cukup `100 − totalPercentage`.

#### d. Template kantong buatan pengguna

Modal ini **sudah punya** "⚡ Blueprint Cepat" dengan dua preset hardcoded (50-30-20
dan Mahasiswa Hemat) di `applyBlueprint()`. Permintaan ini adalah perluasannya:
template yang bisa disimpan sendiri dengan nama custom.

**Satukan keduanya jadi satu daftar**, jangan buat konsep sejajar. Blueprint bawaan
menjadi "template sistem" yang tidak bisa dihapus; template pengguna muncul di daftar
yang sama, bisa diubah dan dihapus. Satu daftar, satu cara pakai, satu tempat mencari.

```prisma
model PocketTemplate {
  id        String   @id @default(uuid())
  userId    String
  name      String                    // nama custom, mis. "Bulan Ramadan"
  /// [{ categoryId, limitType, percentage, limitAmount, keywords }]
  pockets   Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])   // nama template unik per pengguna
  @@schema("kainest")
}
```

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/budget/pocket-templates` | Daftar template pengguna (blueprint sistem tetap dari frontend) |
| `POST` | `/budget/pocket-templates` | Simpan susunan kantong yang sedang dibuka |
| `PUT` | `/budget/pocket-templates/:id` | Ganti nama / timpa isi |
| `DELETE` | `/budget/pocket-templates/:id` | Hapus |

Alurnya: susun kantong seperti biasa → **"Simpan sebagai Template"** → beri nama →
lain waktu pilih dari daftar → seluruh isi modal terganti.

**Menerapkan template selalu menimpa**, tidak pernah menggabung. Menggabung
memunculkan pertanyaan yang tidak punya jawaban benar (kategori sama beda persentase
— pakai yang mana?). `applyBlueprint()` sudah menimpa (`pocketsData.value = []`), jadi
ini konsisten. Karena menimpa, **wajib ada konfirmasi** bila ada perubahan yang belum
disimpan — `hasChanges` (baris 362) sudah tersedia untuk itu.

**Empat hal yang harus ditangani, kalau tidak template jadi jebakan:**

1. **Kategori terhapus.** Template menyimpan `categoryId`. Kalau kategorinya sudah
   tidak ada, entri itu **dilewati** saat diterapkan, dan pengguna diberi tahu:
   *"2 kantong dilewati karena kategorinya sudah dihapus."* Jangan gagal senyap, dan
   jangan gagal total.
2. **Template nominal vs gaji berubah.** Template `limitType: 'nominal'` menyimpan
   angka mati. Gaji naik dari Rp6jt ke Rp8jt, template tetap membagi seperti Rp6jt.
   Beri catatan di UI saat menyimpan template yang berisi nominal; jangan dilarang —
   sebagian orang memang menginginkan angka tetap.
3. **Total >100% di template.** Bisa terjadi karena disimpan saat gaji berbeda.
   Terapkan tetap, tapi peringatan >100% yang sudah ada (baris 29, 238) langsung
   menyala dan tombol Simpan tetap terkunci. Perilaku lama, tidak perlu yang baru.
4. **Batas jumlah template.** Belum perlu. Kalau nanti disalahgunakan, batasi.

### 12.3 Urutan pengerjaan

Ditaruh sebagai **Fase 0** karena tidak bergantung pada apa pun dan langsung terasa
manfaatnya.

| Langkah | Isi | Selesai berarti |
|---|---|---|
| 0a | Perbaikan notifikasi dobel (§12.1) | Transaksi ke periode tutup buku memunculkan **satu** toast kuning |
| 0b | Kartu baru di atas + scroll + fokus (§12.2a) | Klik "+ Kantong" langsung terlihat |
| 0c | Sisa persentase + tombol pakai sisa (§12.2b, c) | Sisa tampil dalam persen dan rupiah |
| 0d | `PocketTemplate` + endpoint + UI daftar template (§12.2d) | Simpan template, tutup modal, buka lagi, terapkan — susunan kembali |

0a–0c murni frontend dan bisa langsung dirilis. 0d menyentuh skema, jadi digabung ke
migrasi Fase 1 fitur utama supaya `prisma migrate` hanya sekali.
