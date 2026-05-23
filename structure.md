# Struktur Direktori Aplikasi (Kainest Backend)

Aplikasi ini menggunakan **Clean Architecture** berbasis Fitur (Feature-Based Architecture). Hal ini membuat kode lebih modular, mudah di-maintain, dan scalable.

```text
KAINEST_BE/
├── prisma/
│   ├── schema.prisma          # Skema database Prisma (definisi model)
│   └── migrations/            # Riwayat migrasi database
├── src/
│   ├── app.ts                 # Inisialisasi aplikasi Hono, middleware global, & registrasi route
│   ├── server.ts              # Entry point aplikasi (menjalankan server pada port tertentu)
│   ├── core/                  # Logika inti aplikasi, konfigurasi, dan error handling
│   │   ├── config/            # Konfigurasi environment (env vars)
│   │   ├── exceptions/        # Custom error classes
│   │   └── middlewares/       # Middleware global (misal: error handler, logger)
│   ├── infrastructure/        # Implementasi teknis & integrasi pihak ketiga
│   │   ├── database/
│   │   │   └── prisma.ts      # Instansiasi Prisma Client global
│   │   └── services/          # Integrasi layanan eksternal (misal: Cloudinary, dll)
│   ├── utils/                 # Fungsi helper/utilitas (misal: formatter, generator)
│   └── features/              # Modul fitur-fitur aplikasi
│       ├── auth/              # Otentikasi (Login, Register)
│       ├── budgeting/         # Pengelolaan keuangan
│       ├── couple/            # Manajemen relasi/pasangan
│       ├── notes/             # Catatan
│       ├── profile/           # Profil pengguna
│       ├── todos/             # Tugas/Todo list
│       ├── upload/            # Upload file/gambar
│       └── wabot/             # Integrasi WhatsApp Bot
```

## Struktur Dalam Setiap Fitur (Contoh: `auth`)
Setiap folder fitur (misalnya `auth`) memiliki struktur layer internal berikut:

```text
auth/
├── data/                      # Layer Data (Implementasi Repository)
│   └── auth.repository.ts     # Berinteraksi dengan database via Prisma
├── domain/                    # Layer Domain (Aturan Bisnis & Use Cases)
│   ├── entities/              # Struktur data/tipe (opsional jika pakai tipe Prisma)
│   └── use-cases/             # Logika bisnis spesifik
│       ├── login.use-case.ts
│       └── register.use-case.ts
└── presentation/              # Layer Presentasi (Controller & Routes)
    ├── auth.controller.ts     # Menangani request dan response HTTP
    └── auth.route.ts          # Definisi endpoint (misal: app.post('/login'))
```

## Alur Data (Data Flow)
1. **Client (Frontend)** memanggil endpoint yang didefinisikan di **Route** (`presentation/`).
2. **Route** meneruskan request ke **Controller** (`presentation/`).
3. **Controller** mengekstrak dan memvalidasi data (body/params), lalu memanggil **Use Case** (`domain/`).
4. **Use Case** memproses logika bisnis dan memanggil **Repository** (`data/`) jika butuh akses data.
5. **Repository** berinteraksi dengan database menggunakan **Prisma** (`infrastructure/`).
6. Hasilnya dikembalikan secara berantai kembali ke **Client**.