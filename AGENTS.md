# 🤖 Kainest Backend — Software Requirements Specification (SRS) & Agent Guidelines

Dokumen ini mendefinisikan spesifikasi kebutuhan perangkat lunak (SRS), arsitektur, skema database, spesifikasi API, perubahan sistem terbaru, serta rencana pengembangan masa depan untuk **Kainest Backend (`Kainest_Be`)**. Dokumen ini bersifat _living document_ dan ditujukan bagi pengembang serta AI Agent yang bekerja pada repositori ini.

> **PENTING UNTUK AGENT**: Selalu baca dokumen ini terlebih dahulu sebelum melakukan perubahan apapun pada kode. Patuhi aturan arsitektur, konvensi naming, dan pola response yang sudah ditetapkan.

---

## 1. PENDAHULUAN (SYSTEM OVERVIEW)

Kainest Backend adalah layanan API server berbasis **Hono.js (Node.js/TypeScript)** yang menyediakan _backend engine_ untuk aplikasi asisten keuangan personal dan pasangan (Kainest).

Sistem ini bertanggung jawab atas:
- Autentikasi & manajemen sesi pengguna (via Better Auth)
- Pengelolaan "Kantong" budget bulanan berbasis persentase atau nominal
- Penyimpanan & pengambilan data riwayat keuangan bulanan (Monthly Financial History)
- Pencatatan transaksi harian
- Integrasi AI (Groq LLM) untuk klasifikasi transaksi berbasis teks alami & saran finansial
- Logging struktural setiap permintaan HTTP secara global

---

## 2. ARSITEKTUR & STRUKTUR SISTEM (ARCHITECTURAL SPECIFICATION)

Proyek ini mengadopsi **Feature-Based Clean Architecture** (Domain-Driven Design) untuk mempermudah modularitas, perawatan, dan perluasan sistem.

### 2.1 Struktur Direktori Utama

```text
src/
├── app.ts                  # Inisialisasi Hono app, global middleware (CORS, Logging), & pendaftaran route
├── server.ts               # Entry point aplikasi (menjalankan HTTP server Node.js)
├── infrastructure/         # Integrasi layanan pihak ketiga
│   ├── auth.ts             # Konfigurasi Better Auth
│   ├── database/           # Prisma Client singleton
│   ├── ai/                 # Groq AI service
│   ├── cloud/              # Cloudinary client
│   └── middlewares/
│       ├── AuthMiddleware.ts      # Middleware validasi JWT token
│       ├── ErrorMiddleware.ts     # Global error handler
│       └── LoggingMiddleware.ts   # 🆕 Global structured JSON logging
├── utils/                  # Fungsi pembantu global
└── features/               # Modul fitur terisolasi (Domain-Driven)
    ├── auth/
    ├── budgeting/
    ├── notes/
    ├── todos/
    ├── profile/
    ├── couple/
    ├── wabot/
    ├── upload/
    └── admin/
```

### 2.2 Lapisan Modul Fitur (`features/budgeting/` sebagai contoh)

Alur data satu arah: **Route → Controller → Use Case → Repository → Database**

| Lapisan | File | Tanggung Jawab |
|---|---|---|
| **Presentation** | `budgetRoute.ts` | Mendaftarkan endpoint HTTP & menghubungkan dengan middleware auth |
| **Presentation** | `budgetController.ts` | Ekstrak parameter dari Hono Context `c`, teruskan ke Use Case, kembalikan JSON response |
| **Domain** | `domain/use-cases/*.ts` | Logika bisnis inti — agnostik terhadap HTTP & framework database |
| **Data** | `data/BudgetRepository.ts` | Mengabstraksikan & mengeksekusi operasi database via Prisma ORM |
| **Data** | `data/PocketRepository.ts` | Operasi database khusus untuk entitas `BudgetPocket` |

### 2.3 Aturan & Standar Pengembangan Wajib (Untuk Agent)

- **Strict Clean Architecture**: Jangan pernah memanggil Prisma Client secara langsung dari Controller. Semua I/O database harus melewati Repository.
- **Pola Response**: Gunakan pola `success/failure` yang konsisten. Di sisi backend (Use Case), kembalikan objek dengan format `{ success: true, data: ... }` atau `{ success: false, status: number, message: string }`.
- **Pola Either di Frontend**: Pengecekan hasil Use Case di frontend menggunakan properti `.right` (sukses) dan `.left` (gagal). **Jangan** memanggil `.isRight()` karena tidak didukung.

---

## 3. SPESIFIKASI DATABASE (DATABASE SCHEMA)

Menggunakan **PostgreSQL** (via Supabase) dengan **Prisma ORM**. Semua model berada di schema `kainest`.

### 3.1 Model Utama Fitur Budgeting

#### `BudgetCategory`
Daftar kategori pengeluaran yang dapat digunakan sebagai "label" kantong.
- `isDefault: Boolean` — `true` untuk kategori sistem (global), `false` untuk kategori kustom user.
- `userId: String?` — `null` untuk kategori global (admin/sistem), diisi ID user untuk kategori yang dibuat user sendiri.
- `keywords: String[]` — Kata kunci untuk klasifikasi transaksi AI (contoh: `["makan", "gofood", "warteg"]`).
- `type: TransactionType` — Enum `INCOME` atau `EXPENSE`.

> **Logika Visibilitas Kategori**: Query `findAllCategories(userId)` menggunakan `OR` logic: mengembalikan semua kategori yang `isDefault: true` **ATAU** milik `userId` tersebut. User hanya melihat kategori global + kategori kustom miliknya sendiri.

#### `BudgetPocket`
Template kantong budget permanen milik user per kategori. Ini adalah **sumber kebenaran (source of truth)** untuk konfigurasi alokasi budget user.
- `percentage: Float?` — Alokasi sebagai persentase dari gaji (misal: `20` untuk 20%).
- `limitAmount: Float?` — Alokasi sebagai nominal Rupiah tetap (misal: `500000`).
- `@unique([userId, categoryId])` — Satu user hanya boleh punya satu kantong per kategori.

#### `MonthlyFinancialHistory` 🆕
Snapshot riwayat keuangan per bulan per user. **Tabel Budget lama sudah dihapus dan digantikan sepenuhnya oleh tabel ini.**
- `period: DateTime (@db.Date)` — Tanggal awal bulan (misal: `2026-05-01`).
- `salarySnapshot: Int` — Gaji user pada saat snapshot dibuat.
- `totalBudgeted: Int` — Total nominal yang dialokasikan ke semua kantong bulan tersebut.
- `totalSaved: Int` — Total nominal yang dialokasikan ke kantong tabungan/saving.
- `totalSpent: Int` — Total pengeluaran aktual bulan tersebut (dihitung dinamis dari tabel `Transaction`).
- `pocketsSnapshot: Json` — **Fotokopi JSON** dari semua kantong aktif user pada saat itu, berisi: `[{ categoryId, categoryName, icon, limitAmount }]`.
- `aiEvaluation: String?` — Hasil teks evaluasi AI di akhir bulan.
- `@unique([userId, period])` — Satu history per user per bulan.

#### `Transaction`
Catatan pengeluaran/pemasukan harian.
- `amount: Int`, `note: String?`, `date: DateTime`, `categoryId: String`, `userId: String`.

#### `AISuggestion`
Log saran finansial yang dihasilkan oleh AI Groq.

#### `BotActiveGroup` 🆕
Menyimpan ID grup WhatsApp yang telah diaktifkan untuk bot pencatatan keuangan (Kainest WA Bot).
- `id: String` (Primary Key, UUID)
- `groupId: String` (@unique, ID grup dari WhatsApp/Baileys)
- `createdAt: DateTime`
- `@index([groupId])`
- `@@schema("kainest")`

---

## 4. SPESIFIKASI ENDPOINT & API (API SPECIFICATION)

Semua endpoint di bawah path `/budget/`, `/profile/`, `/couple/`, dll. **diwajibkan** melewati `authMiddleware`. Satu-satunya pengecualian adalah endpoint `/auth/*`.

### 4.1 Manajemen Kategori

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| `GET` | `/budget/categories` | Ambil daftar kategori (global + kustom milik user yang sedang login). | ✅ |
| `POST` | `/budget/categories` | 🆕 Buat kategori kustom baru milik user. Payload: `{ name: string, icon: string }` | ✅ |
| `PATCH` | `/budget/categories/:categoryId/keywords` | Perbarui daftar kata kunci AI untuk satu kategori. Payload: `{ keywords: string[] }` | ✅ |

### 4.2 Manajemen Kantong Budget (Pockets)

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| `GET` | `/budget/pockets` | Ambil semua kantong milik user yang sedang aktif. | ✅ |
| `PUT` | `/budget/pockets` | Buat atau perbarui satu kantong. Payload: `{ categoryId, percentage?, limitAmount? }` | ✅ |
| `DELETE` | `/budget/pockets/:categoryId` | Hapus satu kantong. | ✅ |
| `POST` | `/budget/pockets/setup` | Bulk setup kantong (onboarding). Payload: `{ pockets: Array<...> }` | ✅ |

### 4.3 Dashboard & Ringkasan

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| `GET` | `/budget/summary` | Ambil ringkasan keuangan bulan berjalan dari `MonthlyFinancialHistory`. Jika history bulan ini belum ada, sistem akan **otomatis membuatnya (lazy loading)** dari template `BudgetPocket` user. | ✅ |
| `GET` | `/budget/history` | 🆕 Ambil **seluruh riwayat keuangan bulanan** milik user, diurutkan dari yang terbaru. Digunakan oleh halaman Riwayat Keuangan Bulanan di frontend. | ✅ |
| `GET` | `/budget/trend` | Data pengeluaran harian (untuk grafik). | ✅ |
| `POST` | `/budget/setup` | Setup konfigurasi awal gaji user. | ✅ |

### 4.4 Transaksi

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| `POST` | `/budget/transactions` | Catat transaksi baru. | ✅ |
| `GET` | `/budget/transactions` | List transaksi dengan filter & pagination. | ✅ |
| `GET` | `/budget/transactions/:id` | Detail satu transaksi. | ✅ |
| `PUT` | `/budget/transactions/:id` | Update transaksi. | ✅ |
| `DELETE` | `/budget/transactions/:id` | Hapus transaksi. | ✅ |

### 4.5 AI & Evaluasi

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| `POST` | `/budget/classify` | Klasifikasi teks pengeluaran alami via Groq AI. Payload: `{ text: string }` | ✅ |
| `GET` | `/budget/advisor/:categoryId` | Saran finansial AI untuk kategori tertentu. | ✅ |
| `GET` | `/budget/status/:categoryId` | Status zona harian (Green/Yellow/Red/Overspent). | ✅ |
| `POST` | `/budget/evaluate` | Evaluasi keuangan akhir bulan via AI. | ✅ |

---

## 5. ALUR KERJA UTAMA (KEY WORKFLOWS)

### 5.1 Alur Lazy Loading Riwayat Bulanan

Setiap kali endpoint `GET /budget/summary` dipanggil, sistem memeriksa apakah sudah ada record di `MonthlyFinancialHistory` untuk bulan berjalan. Jika belum ada:

```
GET /budget/summary
    → Cari MonthlyFinancialHistory bulan ini
    → [Tidak ada] → Ambil BudgetPocket user + salary
    → Hitung limitAmount dari persentase × salary
    → Upsert record baru ke MonthlyFinancialHistory
    → Lanjutkan kalkulasi summary dari snapshot tersebut
```

> **Efek**: Sistem otomatis "pindah bulan" tanpa cron job atau intervensi manual. History baru dibuat saat user pertama kali membuka dashboard di bulan baru.

### 5.2 Alur Klasifikasi Transaksi AI (Kenin)

```
Input teks user ("makan bakso 15k")
    → Ambil daftar BudgetPocket aktif user + keywords tiap kategori
    → Bangun prompt Groq dengan konteks kantong user
    → Kirim ke Groq LLM
    → Validasi: apakah categoryId yang dikembalikan ada di kantong user?
        → [Ya] → Return JSON terstruktur { categoryId, amount, note }
        → [Tidak] → Fallback ke kategori "Lain-lain"
```

**Safeguard AI:**
- Context limiting: LLM hanya diberi pilihan kategori dari kantong yang aktif.
- Strict matching: Jika LLM memilih di luar daftar, sistem paksa fallback.
- Parser nominal: `"15k"` → `15000`, `"20rb"` → `20000`, `"1jt"` → `1000000`.

---

## 6. SISTEM LOGGING (LOGGING SPECIFICATION) 🆕

### 6.1 `LoggingMiddleware.ts`

Middleware global yang di-mount di `app.ts` **setelah CORS dan sebelum semua route**. Setiap HTTP request akan menghasilkan satu baris log berformat JSON.

**Format Log:**
```json
{
  "timestamp": "2026-05-31T13:44:17.456+07:00",
  "level": "INFO",
  "service": "kainest-api",
  "event": "http_request",
  "correlation_id": "req-a1b2c3d4",
  "endpoint": "POST /budget/transactions",
  "user_id": "qu4k76pZXH5nc...",
  "status": "success",
  "response_code": 200,
  "latency_ms": 142,
  "message": "Request processed successfully"
}
```

**Level Mapping:**
- `INFO` — `response_code` 1xx–3xx
- `WARN` — `response_code` 4xx
- `ERROR` — `response_code` 5xx

**Strategi Output:**
- **Production (Vercel)**: Cetak ke `console.log` / `console.error` → ditangkap Vercel Log Dashboard / Log Drain.
- **Development Lokal**: Cetak ke konsol + tulis ke file `logs/kainest_api_YYYYMMDD.log` (Daily Rotation) secara asynchronous non-blocking menggunakan `fs.promises.appendFile`.

> **Catatan Agent**: Folder `logs/` diabaikan oleh `.gitignore`. Jangan pernah commit file log ke repository.

---

## 7. PERUBAHAN & FITUR YANG SUDAH DILAKUKAN (CHANGELOG)

| # | Fitur / Perbaikan | Deskripsi Singkat |
|---|---|---|
| 1 | **Migrasi ke `MonthlyFinancialHistory`** | Tabel `Budget` dihapus. Sistem kini menggunakan `MonthlyFinancialHistory` sebagai snapshot bulanan yang menyimpan `pocketsSnapshot` dalam format JSON. `BudgetPocket` menjadi satu-satunya template permanen. |
| 2 | **Lazy Loading History Bulanan** | `GetMonthlySummaryUseCase` otomatis membuat record `MonthlyFinancialHistory` baru jika bulan berganti, tanpa perlu cron job. |
| 3 | **Kategori Kustom User** | Endpoint `POST /budget/categories` ditambahkan. User biasa dapat membuat kategori kantong sendiri (emoji + nama). Query kategori kini menggunakan `OR` logic: kategori global + milik user. |
| 4 | **Global Structured Logging** | `LoggingMiddleware.ts` dipasang secara global. Format JSON terstruktur dengan daily log rotation untuk keperluan ETL & monitoring. |
| 5 | **Blueprint Kantong Cepat** | `PocketManagementModal.vue` memiliki tombol blueprint (50-30-20 dan Mahasiswa Hemat) untuk konfigurasi kantong sekali klik. |
| 6 | **Refactoring AI Use Cases** | `EvaluateMonthlyBudgetUseCase`, `GetDailyBudgetStatusUseCase` direfactor agar membaca limit dari `pocketsSnapshot` JSON alih-alih tabel `Budget` yang sudah dihapus. |
| 7 | **Better Auth Alignment** | Route auth diselaraskan dengan standard endpoints Better Auth. Alur social login callback (`/auth/social-callback`) menggunakan token via URL hash untuk menghindari masalah cross-domain cookie. |
| 8 | **Optimasi Serverless Vercel** | Region fungsi Vercel dikonfigurasi ke `sin1` (Singapura) agar selaras dengan lokasi Supabase DB guna meminimalkan latency. |
| 9 | **Endpoint `GET /budget/history`** | `findAllMonthlyHistory(userId)` ditambahkan ke `BudgetRepository.ts`. Use Case baru `GetMonthlyHistoryUseCase.ts` dibuat. Controller `getMonthlyHistoryController` dan route `GET /budget/history` didaftarkan. Mengembalikan seluruh riwayat bulanan milik user diurutkan `period: desc`. |
| 10 | **Perbaikan `createCustomCategory` (Keamanan)** | Validasi kepemilikan ditambahkan: hanya user yang terautentikasi dapat membuat kategori, dan `userId` diambil dari sesi server (bukan dari body request) untuk mencegah injeksi. |
| 11 | **Perbaikan Sinkronisasi Data Pocket (Anti-Zombie)** | Menerapkan `deleteMany` sebelum `upsert` pada `bulkUpsertPockets` di `PocketRepository.ts` agar kantong lama yang dihapus/diganti dari payload tidak menjadi zombie di database. Serta penambahan validasi duplikat kategori di `BulkSetupPocketsUseCase.ts`. |
| 12 | **CQRS: Write-Time Sync Riwayat Bulanan** | Tabel riwayat bulanan kini menggunakan sinkronisasi di saat data diubah (*Write-Time Sync*) via method `syncMonthlyHistory` di `BudgetRepository.ts`. Fungsi ini disuntikkan (*trigger*) di `CreateTransactionUseCase`, `DeleteTransactionUseCase`, dan `UpdateTransactionUseCase`. Khusus untuk Update, dilengkapi dengan *Smart Trigger* yang hanya menjalankan sinkronisasi jika nominal, kategori, atau tanggal berubah (mencegah beban berlebih dari sekadar ubah catatan). |
| 13 | **Perbaikan Kalkulasi Tabungan (Actual vs Target)** | Kalkulasi `totalSaved` di `syncMonthlyHistory` pada `BudgetRepository.ts` diubah agar menggunakan nilai pengeluaran riil (uang yang dialokasikan ke kategori tabungan) alih-alih limit target, serta mengecualikan nilai tabungan tersebut dari `totalSpent` (aktual pengeluaran). |
| 14 | **Preservasi Data Riwayat Bulanan Saat Setup Pocket/Budget** | Mengubah `BulkSetupPocketsUseCase.ts` dan `SetupMonthlyBudgetUseCase.ts` agar tetap mempertahankan nilai `totalSaved` dan `totalSpent` ketika memperbarui kantong, dilanjutkan dengan memanggil `syncMonthlyHistory` agar data terhitung ulang dengan aman. |
| 15 | **Script Migrasi & Sinkronisasi Backfill (`force-sync-pockets.ts`)** | Membuat script utility `force-sync-pockets.ts` untuk memigrasi dan melakukan sinkronisasi data riwayat keuangan bulanan historis (November 2025 s.d. April 2026) dengan template layout pocket saat ini agar data rencana, aktual, dan tabungan sinkron. |
| 16 | **Migrasi Skema Bot WhatsApp (`BotActiveGroup`)** | Menambahkan model `BotActiveGroup` ke `schema.prisma` dan menyinkronkan database Supabase menggunakan `prisma db push` untuk menyimpan data grup WA aktif bagi integrasi WhatsApp Bot komersial. |

---

## 8. RENCANA PENGEMBANGAN MASA DEPAN (FUTURE DEVELOPMENT)

1. **Integrasi WhatsApp Bot (Kenin WA Bot)**: Pencatatan transaksi via chat WhatsApp menggunakan `classifyTransactionUseCase`.
   - *Penyimpanan Grup Aktif*: Database sudah dimigrasi dengan tabel `BotActiveGroup` untuk memfasilitasi aktivasi/deaktivasi bot per grup WhatsApp menggunakan perintah `!aktifkan-kainest` dan `!nonaktifkan-kainest`.
   - *Arsitektur Multi-User*: Menggunakan pencocokan nomor WhatsApp JID pengirim dengan kolom `whatsappNumber` di tabel `User`.
   - *Keamanan API*: Mengamankan endpoint bot `POST /api/bot/transactions` menggunakan API Key rahasia khusus server-to-server (n8n ke Backend).
   - *Optimasi Token*: Menerapkan sistem *Hybrid Routing*. Pesan masuk divalidasi dengan pencocokan kata kunci (*rule-based keyword matching*) di database terlebih dahulu. Jika cocok, catat langsung; jika tidak cocok, baru teruskan ke Groq AI (Llama 8B) sebagai *fallback* guna menghemat token hingga 80%.
2. **Rekomendasi Rebalancing Otomatis**: AI menyarankan penyesuaian alokasi kantong berdasarkan riwayat pengeluaran `MonthlyFinancialHistory` bulan-bulan sebelumnya.
3. **Pipeline ETL Log**: Mengekstrak file log harian (`logs/kainest_api_YYYYMMDD.log`) ke data warehouse (PostgreSQL / BigQuery) untuk analisis penggunaan dan deteksi anomali.
4. **Pendeteksi Pengeluaran Berulang**: Analisis AI untuk mengenali transaksi bulanan otomatis (sewa, langganan) dan memasukkannya secara berkala ke kantong yang sesuai.
5. **Handbook / Panduan Fitur In-App (Backend Support)**: Endpoint opsional untuk menyajikan konten panduan yang dapat diperbarui secara dinamis (misal: API untuk mengambil teks panduan per fitur).
6. **Pembatasan Query Default Riwayat (6/12 Bulan)**: Method `findAllMonthlyHistory` saat ini mengambil semua record tanpa batas. Perlu ditambahkan parameter opsional `take` (misal `take: 12`) pada query Prisma agar default hanya mengembalikan 6 atau 12 bulan terakhir.
7. **Filter Query Tahun/Bulan pada Endpoint History**: Menambahkan dukungan query parameter `?year=2026` or `?from=2026-01&to=2026-12` pada endpoint `GET /budget/history` agar frontend dapat memfilter rentang waktu yang diinginkan tanpa mengambil semua data.
