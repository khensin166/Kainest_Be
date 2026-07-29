-- Migration: Update payday default dan set semua user existing ke akhir bulan
-- Tanggal: 2026-07-30
-- Deskripsi: Mengubah default payday dari 1 ke 31 (Akhir Bulan) dan
--            menyetel semua user yang sudah ada ke tanggal 31

-- 1. Ubah nilai default kolom payday di tabel User
ALTER TABLE kainest."User"
  ALTER COLUMN payday SET DEFAULT 31;

-- 2. Setel semua user existing yang masih menggunakan nilai default lama (1)
--    atau belum memiliki preferensi khusus menjadi 31 (Akhir Bulan)
UPDATE kainest."User"
  SET payday = 31
  WHERE payday = 1;
