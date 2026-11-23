# Panduan Testing Manual Admin: Trigger Monthly Reset

Dokumen ini berisi panduan untuk melakukan *testing* atau eksekusi fungsi krusial secara manual via API khusus Admin. Endpoint ini dilindungi oleh otorisasi (role `ADMIN`) sehingga hanya akun admin yang bisa menjalankannya.

## 1. Trigger Monthly Reset & Evaluasi AI Qwen

Fungsi ini mensimulasikan proses cron job yang berjalan setiap tengah malam setelah hari gajian (payday). Sistem akan merangkum keuangan bulan lalu dan memanggil AI Qwen untuk memberikan evaluasi.

### Spesifikasi Endpoint
| Method | URL | Headers | Body (JSON) |
|---|---|---|---|
| `POST` | `/api/admin/trigger-monthly-reset` | `Authorization: Bearer <ADMIN_TOKEN>` | `{ "targetUserId": "uuid-user-disini" }` |

### Skenario Pengujian (Test Cases)

#### Skenario 1: Eksekusi Berhasil (User Valid)
**Tujuan:** Memastikan AI Qwen dan logika *monthly reset* berjalan untuk user tertentu tanpa menunggu *cron job*.
**Perintah cURL:**
```bash
curl -X POST http://localhost:8000/api/admin/trigger-monthly-reset \
-H "Content-Type: application/json" \
-H "Authorization: Bearer MASUKAN_TOKEN_ADMIN_ANDA" \
-d '{"targetUserId": "ISI_DENGAN_USER_ID_YANG_VALID"}'
```
**Expected Outcome:**
- **Response API:** `200 OK` dengan pesan `"Berhasil men-trigger monthly reset untuk user..."`.
- **Database:** Tercipta *record* baru di tabel `AISuggestion` dengan tipe `MONTHLY_RESET`.
- **Bot WhatsApp:** Jika user tersebut mendaftarkan nomor WA, ia akan menerima pesan ringkasan bulanan beserta *insight* dari Qwen ("Bulan lalu gajimu...").

#### Skenario 2: Gagal karena Parameter Kosong
**Tujuan:** Memastikan pengamanan parameter berjalan, sehingga tidak ada eksekusi massal (menghindari dampak ke seluruh user).
**Perintah cURL:**
```bash
curl -X POST http://localhost:8000/api/admin/trigger-monthly-reset \
-H "Content-Type: application/json" \
-H "Authorization: Bearer MASUKAN_TOKEN_ADMIN_ANDA" \
-d '{}'
```
**Expected Outcome:**
- **Response API:** `400 Bad Request` dengan pesan `"targetUserId is required in body."`.

#### Skenario 3: Gagal karena Unauthorized (Role Bukan Admin)
**Tujuan:** Memastikan endpoint aman dari akses *user* biasa atau peretas.
**Perintah cURL:** Sama seperti Skenario 1, tetapi gunakan token JWT milik *user* biasa.
**Expected Outcome:**
- **Response API:** `403 Forbidden` atau `401 Unauthorized`.

---

## 2. Unit Testing Otomatis

Selain pengujian manual di atas, skenario ini juga telah diintegrasikan ke dalam sistem **Automated Unit Testing** menggunakan `Vitest`. 
Setiap kali ada *push* atau *deployment*, pengujian ini akan otomatis dijalankan untuk menjamin fungsi *reset* tidak rusak.

**Perintah Menjalankan Unit Test di Lokal:**
```bash
npm run test
# atau spesifik ke file:
npx vitest run src/features/admin/domain/use-cases/trigger-monthly-reset.test.ts
```
