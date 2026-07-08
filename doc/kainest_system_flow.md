# 🏗️ Arsitektur & Alur Sistem Kainest (GOWA + Backend + Frontend)

Dokumen ini menjelaskan gambaran umum bagaimana seluruh layanan dalam ekosistem **Kainest** saling berkomunikasi, mulai dari sisi pengguna (WhatsApp / Web) hingga eksekusi AI dan Database.

---

## 🌍 Peta Lingkungan (Environment)

Untuk menjaga keamanan data dan stabilitas aplikasi, sistem Kainest dibagi menjadi dua environment utama yang berjalan pada VPS yang sama melalui container Docker yang terisolasi.

### 1. Production (Live)
Lingkungan yang digunakan oleh *user* publik.
*   **Frontend Web:** `https://kainest.kenantomfie.site` (Vercel)
*   **Backend Hono:** `https://kainest-be.kenantomfie.site` (VPS / Nginx)
*   **GOWA Bot:** `https://gowa.kenantomfie.com` (VPS / Nginx, tersambung ke nomor WA Official)
*   **Database:** Supabase PostgreSQL (Production Schema)

### 2. Staging (Testing / Development)
Lingkungan khusus administrator & developer untuk bereksperimen.
*   **Frontend Web:** `https://staging.kainest.kenantomfie.site` (Vercel)
*   **Backend Hono:** `https://staging.kainest-be.kenantomfie.site` (VPS / Nginx)
*   **GOWA Bot Staging:** Berjalan pada port/nomor berbeda dengan *Safe Mode* aktif (Hanya merespons daftar nomor WA Admin).
*   **Database:** Supabase PostgreSQL (Staging Schema / Data Mockup)

---

## 🔄 Alur Transaksi WhatsApp (Bot Flow)

Berikut adalah urutan proses (*Sequence*) apa yang terjadi saat Anda mengirimkan teks ("Makan siang 20rb") atau *Voice Note* (Pesan Suara) ke bot Kainest di WhatsApp.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User (WhatsApp)
    participant GOWA as 🤖 GOWA Bot (VPS)
    participant Backend as ⚙️ Backend Hono
    participant Whisper as 🎙️ Whisper API (Cloudflare)
    participant DB as 🗄️ Supabase DB
    participant AI as 🧠 Groq AI API

    User->>GOWA: Kirim Pesan Teks / Audio (VN)
    Note over GOWA: GOWA menangkap pesan
    GOWA->>Backend: HTTP POST Webhook (/wabot/webhook/gowa)
    
    Note over Backend: Asynchronous Webhook Processing
    Backend-->>GOWA: HTTP 200 OK (Mencegah Timeout)
    
    alt Jika Pesan Audio (Voice Note)
        Backend->>GOWA: GET /message/{id}/download
        GOWA-->>Backend: File Audio Buffer
        Backend->>Whisper: POST Audio Buffer untuk Transkripsi
        Whisper-->>Backend: Teks ("Makan siang 20 ribu")
    end

    Backend->>DB: Cek User & Grup by Phone Number
    
    alt User/Grup Tidak Terdaftar
        DB-->>Backend: Null / Inaktif
        Backend->>GOWA: HTTP POST /send/reaction (⚠️)
        Backend->>GOWA: HTTP POST /send/message (Pesan Onboarding interaktif)
        GOWA-->>User: "Kamu siapanyakkkk? 👀 ..."
    else User Terdaftar & Valid
        DB-->>Backend: User Data (ID, Name, dll)
        
        Note over Backend: Validasi Lulus, memanggil AI
        Backend->>AI: POST Transaksi & Konteks Kategori
        AI-->>Backend: JSON { "categoryId", "amount", "type" }
        
        Backend->>DB: Simpan Transaksi Baru & Update Rekap Bulanan
        DB-->>Backend: Sukses (tx_id)
        
        Note over Backend: Simulasi Jeda Mengetik (1.5s)
        Backend->>GOWA: HTTP POST /send/reaction (✅ atau 👀)
        Backend->>GOWA: HTTP POST /send/presence (action: start)
        Backend->>GOWA: HTTP POST /send/message (Siap Noted / Balasan Sapaan)
        
        GOWA-->>User: Chat masuk & Reaksi diperbarui
    end
```

### Penjelasan Detail Tiap Aktor:

1. **🤖 GOWA Bot (Go-WhatsApp):**
   Tugasnya murni sebagai **Jembatan/Kurir** (*Gateway*). GOWA membaca pesan WA secara *real-time* lalu melempar isinya ke Backend, dan mengeksekusi pengiriman pesan dari Backend.
2. **⚙️ Backend Hono (Node.js):**
   Ini adalah **Otak Utama (Central Hub)**. Memegang *Business Logic* (Autentikasi, Filter Spam, Verifikasi, Limit Kantong). Merespons *webhook* GOWA secara asinkron agar tidak terjadi *timeout*.
3. **🎙️ Cloudflare Whisper API:**
   Berperan sebagai pengonversi suara ke teks. Menangani input berupa *Voice Note* untuk mempermudah pencatatan transaksi tanpa mengetik.
4. **🧠 Groq AI:**
   Berperan sebagai **Analis Data (Classifier)**. Mengubah *Natural Language* menjadi JSON terstruktur (menentukan kategori, tipe INCOME/EXPENSE, dan nominal).
5. **👤 Frontend Web (Vue 3):**
   Berperan sebagai **Dashboard & Control Panel** (Kategori, Tren Keuangan, Pengaturan).

---

## 🔒 Sistem "Safe Mode" pada Staging
Agar bot *Staging* tidak membocorkan pesan ke publik ketika sedang disempurnakan, Kainest Backend memiliki *Gatekeeper* khusus:
1. Ia mendeteksi variabel `BOT_ENV_MODE=staging`.
2. Saat ada Webhook masuk dari GOWA, Backend akan memeriksa `STAGING_ALLOWED_NUMBERS`.
3. Jika pengirim BUKAN admin, Backend merespons Webhook GOWA dengan **HTTP 200 OK (ignored)**, sehingga bot diam seribu bahasa.
4. Pengecualian pada *Voice Note* di mode staging, jika dari admin akan tetap diproses.

![alt text](image.png)