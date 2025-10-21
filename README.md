# 💞 Kainest — Couple To-Do & Gallery App

Kainest adalah aplikasi web yang dirancang khusus untuk pasangan agar dapat:
- berbagi **to-do list bersama**,  
- mengunggah dan menyimpan **foto kenangan bersama**,  
- serta terhubung satu sama lain melalui **kode undangan unik**.  

Aplikasi ini dibangun menggunakan arsitektur fullstack modern yang ringan, cepat, dan mudah dikembangkan.

---

## 🧩 Arsitektur Sistem

Frontend (Vue 3 + Tailwind + Pinia)
↓
Backend API (Hono.js + Prisma)
↓
Database (Supabase PostgreSQL)
↓
Storage (Cloudinary)

markdown
Copy code

---

## ⚙️ Teknologi yang Digunakan

| Komponen | Teknologi | Keterangan |
|-----------|------------|-------------|
| **Frontend** | Vue 3 + Pinia + TailwindCSS | UI/UX responsif dan modern |
| **Backend** | Hono.js (Node.js) | REST API ringan dan cepat |
| **ORM** | Prisma | Koneksi ke database PostgreSQL |
| **Database** | Supabase (PostgreSQL) | Menyimpan data user, pasangan, to-do, galeri |
| **Storage** | Cloudinary | Penyimpanan gambar |
| **Authentication** | Supabase Auth / bcrypt | Login & register |
| **Realtime (Opsional)** | Supabase Realtime | Sinkronisasi otomatis antar pasangan |
| **Deployment** | Vercel / Render / Netlify | Hosting frontend & backend |

---

## 🧠 Fitur Utama

- 🔐 **Register & Login**
  - Menggunakan Supabase Auth atau endpoint custom (bcrypt hashing)
- 💞 **Hubungkan Pasangan**
  - Dengan kode undangan unik, dua user akan terhubung di tabel `couples`
- ✅ **To-Do List Bersama**
  - CRUD to-do yang dapat dilihat dan diselesaikan oleh kedua pasangan
- 🖼️ **Galeri Foto Bersama**
  - Upload foto ke Cloudinary dan tampilkan berdasarkan pasangan
- 👤 **Profil Pengguna**
  - Ubah nama tampilan, avatar, dan dapatkan kode undangan unik
- 🔔 **(Opsional) Realtime Update**
  - To-do dan galeri otomatis sinkron untuk kedua pengguna

---

## 🗂️ Struktur Proyek

/Kainest_Be
├── src/
│ ├── routes/
│ │ ├── auth.route.ts # Endpoint register, login
│ │ ├── todo.route.ts # CRUD to-do
│ │ ├── gallery.route.ts # Upload & list foto
│ │ ├── couple.route.ts # Menghubungkan pasangan
│ │ └── profile.route.ts # Mengatur profil pengguna
│ ├── prisma/
│ │ └── schema.prisma # Struktur database Prisma
│ ├── utils/
│ │ ├── auth.ts # Helper untuk autentikasi
│ │ └── cloudinary.ts # Upload gambar ke Cloudinary
│ ├── app.ts # Inisialisasi Hono app
│ └── index.ts # Entry point server
│
├── .env # Variabel environment
├── package.json
└── README.md

yaml
Copy code

---

## 🧱 Struktur Database (Supabase)

| Tabel | Deskripsi |
|-------|------------|
| **auth.users** | Data user dari Supabase Auth |
| **user_profiles** | Profil tambahan: display_name, avatar_url, invitation_code |
| **couples** | Menghubungkan dua user (user1_id, user2_id) |
| **todos** | To-do list bersama, relasi ke `couples` dan `users` |
| **photos** | Galeri foto pasangan, relasi ke `couples` dan `users` |

### Diagram Relasi
auth.users
└── user_profiles (1-1)
└── couples (1-n sebagai user1_id dan user2_id)
└── todos (1-n)
└── photos (1-n)
couples
└── todos (1-n)
└── photos (1-n)

yaml
Copy code

---

## 🚀 Cara Menjalankan Proyek

### 1️⃣ Clone Repository
```bash
git clone https://github.com/username/kainest.git
cd kainest
2️⃣ Install Dependencies
bash
Copy code
npm install
3️⃣ Buat File .env
Isi dengan konfigurasi Supabase dan Cloudinary:

env
Copy code
DATABASE_URL="postgresql://postgres:password@db_name.supabase.co:5432/postgres"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your_anon_or_service_key"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
4️⃣ Sinkronisasi Database
bash
Copy code
npx prisma db push
5️⃣ Jalankan Server
bash
Copy code
npm run dev
Server Hono akan berjalan di http://localhost:3000

📸 Alur Fitur "Hubungkan Pasangan"
User A mendaftar dan mendapatkan invitation_code

User B memasukkan kode undangan tersebut

Sistem membuat entri baru di tabel couples

Semua to-do dan foto yang dibuat oleh salah satu user akan otomatis terhubung ke pasangan tersebut (via couple_id)

🧾 Lisensi
Proyek ini dikembangkan oleh Kenan Tomfie Bukit.
Lisensi: MIT © 2025

💬 Catatan Tambahan
Untuk produksi, gunakan Supabase Service Role Key di server.

Pastikan Cloudinary API tidak terekspos di frontend.

File upload ditangani via backend untuk keamanan.