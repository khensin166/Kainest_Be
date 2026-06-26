# Kainest Project - Agent Handoff Notes

## Status Terkini (03 Juni 2026)
- **Frontend (Kainest Vue 3):**
  - Menggunakan UI/UX modern (vibrant colors, glassmorphism, blob animation).
  - Auth flow (Login, Register, Forgot Password, Reset Password) sudah terkoneksi dengan backend *Better Auth*.
  - Halaman Lupa Password (`/forgot-password`) & Reset Password (`/reset-password`) telah didesain ulang dengan gaya *split-screen* yang sama dengan halaman Login.
  - Terdapat komponen panduan (`<PageGuide>`) di seluruh halaman utama.

- **Backend (Kainest_Be - Hono & Prisma):**
  - Menggunakan *Better Auth* v1.6+. Endpoint untuk lupa password berada di `/auth/request-password-reset`.
  - Integrasi **Resend** telah ditambahkan di dalam `auth.ts` untuk mengirimkan email *Reset Password*.
  - Template email telah diekstrak secara rapi ke `src/infrastructure/email/templates/resetPasswordTemplate.ts`.
  - Variabel lingkungan `RESEND_FROM_EMAIL` sudah disiapkan di `.env`.

## Update 04 Juni 2026
- **Frontend**: Dashboard dirombak dengan memfokuskan layout pada ringkasan keuangan dan Aktivitas Terbaru di sisi utama. `System Updates` dan `User Feedback` ditarik dinamis dari API. `DropdownNotifications` kini interaktif (terhubung ke backend). Sidebar `filteredMenu` bereaksi otomatis saat login, dan menu `Vault Rahasia` sudah dilindungi permission.
- **Backend**: Skema `NotificationLog` dan `ShiftActivity` lama dihilangkan, digantikan dengan `AppNotification` & `UserFeedback` serta `SystemUpdate`. Endpoint API notifikasi, feedback, dan changelog (termasuk fitur *Sync dari GitHub* dengan deteksi keyword `[BLAST]`) telah aktif di Hono.
- **Bot WhatsApp**: Alur registrasi `!link` diperketat (tidak bisa lagi aktivasi personal sebelum membuat grup). Bot kini juga merespons transaksi berhasil dengan mengirimkan stiker animasi *kicaw*.

## Update 13 Juni 2026
- **Frontend**:
  - Menyederhanakan modal Atur Pemasukan (`BudgetSetupModal.vue`) dengan menghapus input target tabungan yang redundan dan menambahkan teks edukasi penjelas gaji sebagai acuan 100%.
  - Memberikan helper text tambahan pada tabel input Kelola Kantong (`PocketManagementModal.vue`).
  - Menambahkan panduan visual interaktif (efek *glow pulse* ungu) pada tombol "Kelola Kantong" di dashboard saat terdeteksi user telah mengisi gaji namun belum memiliki kantong sama sekali (alurnya diarahkan secara visual).
- **Backend**:
  - Sinkronisasi skema Prisma (`schema.prisma`) untuk model `BackupTargets`, `ChatLogs`, dan `ApiKeys` dengan schema `kainest`.
  - Pembersihan file client Supabase lama (`supabaseClient.ts`) yang tidak digunakan untuk menjaga kebersihan repositori.
- **Bot WhatsApp (Staging Safe Mode, Ephemeral Fix & Schema Views)**:
  - Mengembalikan konfigurasi schema Supabase ke default (`public`) dan menggunakan PostgreSQL Views di skema `public` yang merujuk ke tabel asli di skema `kainest` untuk menghindari pemblokiran query oleh PostgREST.
  - Menerapkan isolasi environment via `BOT_ENV_MODE` (`staging` / `production`). Pada mode staging, bot hanya merespons nomor terdaftar di `STAGING_ALLOWED_NUMBERS` dan harus diawali perintah `!dev ` (prefix dilepas otomatis saat masuk ke pemrosesan AI).
  - Isolasi blast pengingat shift kerja pada mode staging agar hanya terkirim ke `STAGING_ALLOWED_NUMBERS`.
  - Perbaikan warning *"This message will not disappear..."* dengan menyalin status durasi ephemeral (`expiration` milidetik) dari pesan masuk dan meneruskannya ke objek `sendMessage` (baik teks maupun stiker).

## Update 14 Juni 2026
- **Frontend & Backend (Isolasi Kata Kunci Kantong)**: 
  - Logika kata kunci AI (*keywords*) dipindahkan dari level Kategori ke level Kantong (`BudgetPocket`). Ini memungkinkan pengguna menambahkan kata kunci custom ke kantong mereka sendiri tanpa memengaruhi kategori global atau pengguna lain.
  - Kategori tetap menyimpan `keywords` sebagai *template* (nilai *default*) saat pengguna membuat kantong baru.
  - Jika pengguna mengosongkan *keywords* pada kantongnya, sistem (Kenin AI) akan otomatis melakukan *fallback* ke *keywords* milik kategori sebagai pengaman.

## Update 19 Juni 2026
- **Frontend (UI & UX Dashboard/Rekap)**:
  - Halaman **Rekap Bulanan** (`FinancialHistoryPage.vue`) mendapat fitur *filter* dinamis (3, 6, 12, Semua rentang bulan). Kartu akordion bulan yang berjalan otomatis terbuka (*auto-expand*) saat halaman dimuat. 
  - Membersihkan elemen statis "Rincian segera hadir" dari *Donut Chart* pemasukan, serta mengoptimalkan desain UI dengan menghilangkan label nominal (Masuk/Keluar) ganda di header daftar akordion.
  - Perbaikan *Trend Line Chart* di Dashboard: Sistem sekarang mengagregasi data transaksi sehingga nominal di hari yang sama tergabung menjadi satu titik koordinat yang akurat.
- **Frontend (Transaksi & Form)**:
  - Transaksi tipe pemasukan (*Income*) kini stabil ditampilkan dengan warna Hijau dan *prefix* `+`.
  - Memperbaiki siklus hidup (*lifecycle*) form edit transaksi (`TransactionForm.vue`) dengan menambah *watcher* pada `props.initialData`. Form kini berpindah tab (Pemasukan/Pengeluaran) secara reaktif saat mengedit transaksi berbeda.
  - Menambal *property* `type` yang terlewat pada proses *mapping* (`TransactionEntity.js` dan `BudgetMapper.js`), memastikan komponen UI mengenali tipe transaksi dengan benar.
  - Saat menambah/mengedit transaksi, `useBudgetStore` kini memicu sinkronisasi otomatis ke Riwayat Bulanan.

## Update 20 Juni 2026
- **Frontend (Profile Store)**:
  - Memperbaiki `useProfileStore.js` agar data role dan permissions user tidak hilang (dipertahankan dari session yang sedang berjalan) saat memperbarui profil atau foto profil.
- **Backend (Transaction & Spending Trend)**:
  - Menyertakan include `category` saat data transaksi baru dibuat di `TransactionRepository.ts`.
  - Melakukan agregasi (group-by tanggal) di `GetSpendingTrendUseCase.ts` untuk memastikan transaksi yang terjadi di hari yang sama terjumlah ke satu titik koordinat di diagram tren pengeluaran, sehingga tidak ada duplikasi tanggal.
  - Memastikan properti `type` (INCOME/EXPENSE) hasil klasifikasi AI diteruskan dengan benar ke prisma create di `ProcessBotTransactionUseCase.ts`.
- **Bot WhatsApp (Unified Message Template)**:
  - Memperbarui template respons transaksi berhasil di `expenseUseCase.js` menjadi format tunggal yang dinamis.
  - Template baru mendukung icon kategori dinamis di label Pocket, format waktu terstandar (`20 Juni 2026 pukul 06.33`), header/footer bervariasi yang disesuaikan secara cerdas berdasarkan tipe transaksi (Pemasukan vs Pengeluaran).

## Update 21 Juni 2026
- **Frontend (Tren Keuangan)**:
  - Mengubah tampilan grafik Tren Pengeluaran menjadi _Dual Line Chart_ (Pengeluaran berwarna Merah dan Pemasukan berwarna Hijau).
  - Komponen Vue dan Store telah disesuaikan untuk membaca struktur balasan API baru yang memisahkan `expenseTrend` dan `incomeTrend`.
- **Backend (API & Skema DB)**:
  - Endpoint Tren Pengeluaran kini mem- _fetch_ data transaksi INCOME dan EXPENSE secara paralel dari database dan memisahkannya dalam respons JSON.
  - Menambahkan kolom `botPhoneNumberStaging` ke tabel `WaBotConfig` agar bot Staging dan Production bisa menggunakan nomor WA yang berbeda tanpa saling menimpa data satu sama lain.
  - Membalik urutan validasi grup: Jika *user* tak terdaftar mengirim pesan dari dalam grup, bot akan melakukan _silent ignore_ (tanpa balasan/reaksi sama sekali) untuk mencegah *spam*. Sapaan dasar (`hai`, `halo`) kini diproses sebagai perintah agar bot bisa merespons di grup yang belum diaktifkan.
  - Memperbaiki fitur sinkronisasi *System Updates* dari GitHub. Mengatasi *delay cache* endpoint `/releases` GitHub dengan cara memanggil `/releases/latest` secara paralel dan menggabungkan hasilnya tanpa duplikasi, sehingga rilis yang baru saja dipublikasikan bisa langsung terdeteksi.
- **Bot WhatsApp**:
  - `syncBotInfo` sekarang mengirimkan informasi `BOT_ENV_MODE` ke Backend saat me-*restart* koneksi, memungkinkan Backend memisahkan _update_ profil bot Staging vs Prod.
  - Mengimplementasikan **Jeda Mengetik Universal (1.5s)** pada seluruh _outgoing message_. Selain memberi kesan natural, hal ini terbukti menyelesaikan masalah permanen di mana pesan pertama bot pasca _restart_ sering memunculkan _error_ "Waiting for this message" akibat berpacu dengan inisialisasi _E2EE Sender Key_.

## Update 27 Juni 2026
- **Bot WhatsApp (Auto-Restart QR Code)**:
  - Memperbaiki bug di mana bot tidak memunculkan QR Code baru di web setelah pengguna melakukan *logout* (keluar dari perangkat tertaut di HP).
  - Kini, ketika sesi terputus dengan alasan `loggedOut`, sistem akan secara fisik menghapus folder kredensial `baileys_auth_info` dan melakukan *auto-restart* sesi dalam 3 detik, sehingga QR Code baru otomatis ter- *generate* dan dikirimkan kembali ke Frontend.

## Catatan untuk Agent Selanjutnya
1. Pastikan selalu mematuhi instruksi **Web Application Development** yang mengutamakan UI yang estetik, tidak generik, dan menggunakan animasi ringan (micro-animations).
2. Jika ada masalah terkait rute autentikasi *Better Auth*, perhatikan versi terbarunya (khususnya perbedaan antara endpoint lama `/forget-password` dengan yang baru `/request-password-reset`).
3. Database *Supabase* (pooler port 6543) sesekali mungkin mengalami *timeout* saat inisialisasi awal di mode *development* lokal, cukup jalankan ulang jika terjadi *error*.
4. **Perhatian Penting**: Di sisi Backend, saat ini chat pribadi melalui Linked Devices (`@lid`) memicu error 403 ("bot belum diaktifkan di grup") karena validasi backend menganggap domain JID `@lid` memerlukan aktivasi grup. Ke depannya, validasi ini harus disesuaikan agar mengenali chat pribadi secara tepat.
5. **Peringatan/Future Repair (Disappearing Messages di WA)**: Meskipun parameter `ephemeralExpiration` sudah diekstrak dari pesan masuk dan diteruskan ke opsi pengiriman Baileys sehingga pesan bot kini dapat terbaca dengan baik, terkadang gelembung peringatan WhatsApp *"This message won't disappear. The sender may be on an old version of WhatsApp"* masih muncul secara paralel. Investigasi lebih lanjut diperlukan (misal: memeriksa apakah format ekstraksi regex dari `JSON.stringify(msg)` ada yang kurang presisi, atau status default chat-level ephemeral di sisi client perlu diatur). Hal ini didefer untuk perbaikan di masa mendatang.


---

## Panduan Operasional Administrator
### Cara Merilis "System Updates" & Notifikasi Blast
Untuk menambahkan pembaruan sistem (*changelog*) agar muncul di Dashboard aplikasi, dan/atau mengirim notifikasi ke semua pengguna:

1. **Buat Release di GitHub**:
   - Buka repositori frontend/backend di GitHub.
   - Pergi ke menu **Releases** lalu klik **Draft a new release**.
   - Isi form (pilih/buat Tag baru seperti `v1.4.0`, masukkan judul fitur, dan tulis deskripsi rilis).
2. **Berikan Keyword Blast (Opsional)**:
   - Jika Anda **ingin mengirim notifikasi lonceng** ke semua pengguna terdaftar saat rilis ini disinkronisasi, tambahkan kata kunci `[BLAST]` di bagian mana saja pada deskripsi GitHub Anda.
   - Jika *tidak ingin* mengirim notifikasi (hanya *silent update*), **jangan** cantumkan kata kunci tersebut.
   - Klik **Publish release** di GitHub.
3. **Sinkronisasi di Aplikasi Kainest**:
   - Buka aplikasi Kainest dan *login* menggunakan akun yang memiliki *role* **Admin**.
   - Masuk ke **Dashboard**.
   - Pada panel *System Updates* (Kainest Changelog) di sebelah kanan, klik tombol ungu **"Sync GitHub"**.
   - Server otomatis akan mem- *parsing* rilis baru, menyimpannya di database, dan menghapus teks `[BLAST]` tersebut agar tidak terlihat aneh di UI pengguna.
   - Selesai! Pembaruan kini sudah terpampang di layar seluruh pengguna.

### Cara Mengonfigurasi Docker & Staging Safe Mode di VPS
Karena bot Staging dan Production berjalan di atas VPS yang sama dan menggunakan berkas `.env` yang sama, gunakan fitur override environment pada berkas `docker-compose.yml` VPS Anda untuk mengisolasi perilaku masing-masing instance.

#### 1. Perbarui Berkas `.env` di VPS Anda
Tambahkan/sesuaikan variabel berikut di dalam berkas `.env` global di VPS Anda:

```env
# ==========================================
# 🤖 WA BOT ADVANCED CONFIGURATIONS (Staging Safe Mode)
# ==========================================
# Nomor WhatsApp Admin yang diperbolehkan di mode Staging (pisahkan dengan koma)
STAGING_ALLOWED_NUMBERS="62812345678,62887654321"

# URL Backend Terpisah
KAINEST_API_URL_PROD="https://kainest.be.kenantomfie.site"
KAINEST_API_URL_STAGING="https://staging.kainest.be.kenantomfie.site"
```

#### 2. Perbarui Berkas `docker-compose.yml` di VPS Anda
Sesuaikan bagian service untuk container Production (`wa-bot`) dan Staging (`wa-bot-staging`) agar menggunakan *overrides* variabel lingkungan secara terpisah:

```yaml
version: '3.8'

services:
  # Instance Bot WhatsApp Production
  wa-bot:
    image: wa-bot:latest  # Sesuaikan dengan konfigurasi Anda
    container_name: wa-bot-prod
    restart: always
    environment:
      - PORT=3000
      - BOT_ENV_MODE=production
      - KAINEST_API_URL=${KAINEST_API_URL_PROD}
    env_file:
      - .env
    # ... volume, port, dll.

  # Instance Bot WhatsApp Staging
  wa-bot-staging:
    image: wa-bot:latest  # Sesuaikan dengan konfigurasi Anda
    container_name: wa-bot-staging
    restart: always
    environment:
      - PORT=3001  # Sesuaikan port jika diekspos
      - BOT_ENV_MODE=staging
      - KAINEST_API_URL=${KAINEST_API_URL_STAGING}
      - STAGING_ALLOWED_NUMBERS=${STAGING_ALLOWED_NUMBERS}
    env_file:
      - .env
    # ... volume, port, dll.
```

#### 3. Terapkan Perubahan & Restart Container
Jalankan perintah ini di direktori server VPS Anda untuk menerapkan konfigurasi baru:

```bash
docker compose down
docker compose up -d
```

