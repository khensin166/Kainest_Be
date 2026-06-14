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
Snapshot riwayat keuangan per bulan per user.  - Variabel lingkungan `RESEND_FROM_EMAIL` sudah disiapkan di `.env`.

## Update 04 Juni 2026
- **Frontend**: Dashboard dirombak dengan memfokuskan layout pada ringkasan keuangan dan Aktivitas Terbaru di sisi utama. `System Updates` dan `User Feedback` ditarik dinamis dari API. `DropdownNotifications` kini interaktif (terhubung ke backend). Sidebar `filteredMenu` bereaksi otomatis saat login, dan menu `Vault Rahasia` sudah dilindungi permission.
- **Backend**: Skema `NotificationLog` dan `ShiftActivity` lama dihilangkan, digantikan dengan `AppNotification` & `UserFeedback` serta `SystemUpdate`. Endpoint API notifikasi, feedback, dan changelog (termasuk fitur *Sync dari GitHub* dengan deteksi keyword `[BLAST]`) telah aktif di Hono.
- **Bot WhatsApp**: Alur registrasi `!link` diperketat (tidak bisa lagi aktivasi personal sebelum membuat grup). Bot kini juga merespons transaksi berhasil dengan mengirimkan stiker animasi *kicaw*. digantikan sepenuhnya oleh tabel ini.**
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
- `id: String` (Primary Key, UUID, default auto-generate via database `gen_random_uuid()`)
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
Snapshot riwayat keuangan per bulan per user.
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
- `id: String` (Primary Key, UUID, default auto-generate via database `gen_random_uuid()`)
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
        → [Nicht] → Fallback ke kategori "Lain-lain"
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
| 1 | **Migrasi ke `MonthlyFinancialHistory`** | Tabel `Budget` dihapus. Sistem kini menggunakan `MonthlyFinancialHistory` sebagai snapshot bulanan yang menyimpan `pocketsSnapshot` dalam format JSON. |
| 2 | **Lazy Loading History Bulanan** | `GetMonthlySummaryUseCase` otomatis membuat record `MonthlyFinancialHistory` baru jika bulan berganti. |
| 3 | **Kategori Kustom User** | Endpoint `POST /budget/categories` ditambahkan. Query menggunakan `OR` logic. |
| 4 | **Global Structured Logging** | `LoggingMiddleware.ts` dipasang secara global dengan daily log rotation. |
| 5 | **Blueprint Kantong Cepat** | `PocketManagementModal.vue` memiliki tombol blueprint untuk konfigurasi kantong. |
| 6 | **Refactoring AI Use Cases** | `EvaluateMonthlyBudgetUseCase`, `GetDailyBudgetStatusUseCase` direfactor agar membaca limit dari `pocketsSnapshot` JSON. |
| 7 | **Better Auth Alignment** | Route auth diselaraskan dengan standard endpoints Better Auth menggunakan token via URL hash. |
| 8 | **Optimasi Serverless Vercel** | Region fungsi Vercel dikonfigurasi ke `sin1` (Singapura). |
| 9 | **Endpoint `GET /budget/history`** | `findAllMonthlyHistory` ditambahkan untuk mengambil riwayat bulanan diurutkan `period: desc`. |
| 10 | **Perbaikan `createCustomCategory`** | Validasi kepemilikan ditambahkan untuk mencegah injeksi `userId`. |
| 11 | **Perbaikan Sinkronisasi Pocket** | Menerapkan `deleteMany` sebelum `upsert` untuk mencegah data kantong "zombie". |
| 12 | **CQRS: Write-Time Sync Riwayat Bulanan** | Tabel riwayat bulanan disinkronisasi otomatis saat transaksi diubah (*Write-Time Sync*). |
| 13 | **Perbaikan Kalkulasi Tabungan** | Kalkulasi `totalSaved` menggunakan pengeluaran riil kategori tabungan, mengecualikan nilai tersebut dari `totalSpent`. |
| 14 | **Preservasi Data Riwayat Bulanan** | `BulkSetupPockets` tetap mempertahankan data historis `totalSaved` dan `totalSpent` saat update. |
| 15 | **Script Migrasi & Sinkronisasi Backfill** | Utility `force-sync-pockets.ts` untuk sinkronisasi data historis (Nov 2025 - Apr 2026). |
| 16 | **Migrasi Skema Bot WhatsApp** | Model `BotActiveGroup` didorong ke `schema.prisma` untuk manajemen bot per grup. |
| 17 | **Restrukturisasi Notifikasi & Feedback** | `AppNotification` & `UserFeedback` menggantikan skema lama yang usang. |
| 18 | **Fitur GitHub Sync & Changelog API** | Sinkronisasi rilis GitHub otomatis dengan deteksi tag `[BLAST]`. |
| 19 | **Sinkronisasi Prisma: BackupTargets & ChatLogs** | Penambahan tabel `BackupTargets` & `ChatLogs` ke skema resmi untuk fitur backup chat bot. |
| 20 | **Hapus Dead Code** | Pembersihan `supabaseClient.ts` yang tidak lagi digunakan karena 100% menggunakan Prisma. |
| 21 | **Sinkronisasi Prisma: ApiKeys** | Penambahan tabel `ApiKeys` ke skema resmi untuk manajemen akses webhook Bot. |

---

## 8. RENCANA PENGEMBANGAN MASA DEPAN (FUTURE DEVELOPMENT)

1. **Integrasi WhatsApp Bot (Kenin WA Bot)**: Pencatatan transaksi via chat WhatsApp.
2. **Rekomendasi Rebalancing Otomatis**: AI menyarankan penyesuaian alokasi kantong berdasarkan riwayat pengeluaran.
3. **Pipeline ETL Log**: Mengekstrak file log harian ke data warehouse untuk analisis anomali.
4. **Pendeteksi Pengeluaran Berulang**: Analisis AI untuk mengenali transaksi langganan/berulang otomatis.
5. **Handbook / Panduan Fitur In-App**: Endpoint untuk menyajikan panduan fitur secara dinamis.
6. **Pembatasan Query Default Riwayat (6/12 Bulan)**: Penambahan parameter `take` pada `findAllMonthlyHistory`.
7. **Filter Query Tahun/Bulan pada Endpoint History**: Dukungan query parameter `?year=` atau `?from=&to=` pada endpoint `GET /budget/history`.
8. **Pemisahan Keywords Kantong per User**: Migrasi `keywords` dari `BudgetCategory` ke `BudgetPocket` agar unik per user.
