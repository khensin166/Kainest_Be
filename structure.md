KAINEST_BE/
├── node_modules/
├── prisma/
│   └── schema.prisma     # Model database Anda
├── src/
│   ├── core/             # Logika inti/error/config
│   │   ├── ...
│   ├── features/
│   │   └── auth/
│   │       ├── data/
│   │       │   └── UserRepository.ts  (Sekarang pakai Prisma)
│   │       ├── domain/
│   │       │   ├── entities/
│   │       │   └── use-cases/
│   │       │       ├── LoginUserUseCase.ts
│   │       │       └── RegisterUserUseCase.ts
│   │       └── presentation/
│   │           ├── authController.ts
│   │           └── authRoute.ts         (File rute yang benar)
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── prisma.ts          (Klien Prisma global)
│   │   │   └── supabaseClient.ts  (Hapus jika tidak dipakai lagi)
│   │   └── ...
│   ├── app.ts                # (Komposisi rute, misal: app.route('/auth', authRoute))
│   └── server.ts             # (Entry point: menjalankan server)
├── .env
├── package.json
└── tsconfig.json