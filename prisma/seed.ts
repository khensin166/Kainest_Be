import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.shiftActivity.createMany({
    data: [
      // --- Shift 1 ---
      { shift_type: '1', activity_name: 'Bangun, cuci muka, stretching ringan', time_start: '04:30', reminder_time: '04:00', note: 'Hindari snooze alarm' },
      { shift_type: '1', activity_name: 'Sarapan ringan (oat, telur, buah)', time_start: '05:00', reminder_time: '04:30', note: 'Energi stabil untuk awal shift' },
      { shift_type: '1', activity_name: 'Mulai kerja', time_start: '06:00', reminder_time: '05:30', note: 'Selingi stretching tiap 2 jam' },
      { shift_type: '1', activity_name: 'Snack pagi (buah / kacang / yogurt)', time_start: '09:00', reminder_time: '08:30', note: 'Jaga fokus' },
      { shift_type: '1', activity_name: 'Makan siang', time_start: '12:00', reminder_time: '11:30', note: 'Pilih protein + sayur' },
      { shift_type: '1', activity_name: 'Pulang, mandi, istirahat ringan', time_start: '15:30', reminder_time: '15:00', note: 'Transisi sebelum relaksasi' },
      { shift_type: '1', activity_name: 'Tidur siang (power nap opsional)', time_start: '16:00', reminder_time: '15:30', note: '30–60 menit cukup' },
      { shift_type: '1', activity_name: 'Olahraga ringan, makan malam', time_start: '17:00', reminder_time: '16:30', note: 'Jogging, jalan sore' },
      { shift_type: '1', activity_name: 'Waktu pribadi, hiburan, baca', time_start: '19:00', reminder_time: '18:30', note: 'Hindari layar terlalu lama' },
      { shift_type: '1', activity_name: 'Tidur malam', time_start: '21:00', reminder_time: '20:30', note: 'Prioritaskan tidur 7 jam' },

      // --- Shift 2 ---
      { shift_type: '2', activity_name: 'Bangun, sarapan', time_start: '07:00', reminder_time: '06:30', note: 'Mulai hari dengan tenang' },
      { shift_type: '2', activity_name: 'Olahraga / kegiatan pribadi', time_start: '08:00', reminder_time: '07:30', note: 'Waktu produktif utama' },
      { shift_type: '2', activity_name: 'Makan siang', time_start: '11:00', reminder_time: '10:30', note: 'Sebelum berangkat kerja' },
      { shift_type: '2', activity_name: 'Bersiap ke tempat kerja', time_start: '12:00', reminder_time: '11:30', note: 'Jangan terburu-buru' },
      { shift_type: '2', activity_name: 'Mulai kerja', time_start: '14:00', reminder_time: '13:30', note: 'Fokus dan tetap hidrasi' },
      { shift_type: '2', activity_name: 'Snack sore / buah', time_start: '17:00', reminder_time: '16:30', note: 'Hindari kopi sore' },
      { shift_type: '2', activity_name: 'Makan malam di tempat kerja', time_start: '20:00', reminder_time: '19:30', note: 'Pilih makanan ringan' },
      { shift_type: '2', activity_name: 'Pulang, mandi, relaksasi', time_start: '23:30', reminder_time: '23:00', note: 'Matikan layar HP' },
      { shift_type: '2', activity_name: 'Tidur malam', time_start: '00:00', reminder_time: '23:30', note: 'Gunakan tirai gelap agar tidur nyenyak' },

      // --- Shift 3 ---
      { shift_type: '3', activity_name: 'Bangun, makan siang', time_start: '13:00', reminder_time: '12:30', note: 'Anggap ini “pagi”' },
      { shift_type: '3', activity_name: 'Aktivitas pribadi / olahraga', time_start: '14:00', reminder_time: '13:30', note: 'Waktu produktif siang' },
      { shift_type: '3', activity_name: 'Makan malam', time_start: '17:00', reminder_time: '16:30', note: 'Energi sebelum kerja' },
      { shift_type: '3', activity_name: 'Tidur tambahan / istirahat', time_start: '18:00', reminder_time: '17:30', note: 'Power nap 2–3 jam' },
      { shift_type: '3', activity_name: 'Bersiap kerja', time_start: '21:00', reminder_time: '20:30', note: 'Minum air, hindari kopi berlebihan' },
      { shift_type: '3', activity_name: 'Mulai kerja', time_start: '22:00', reminder_time: '21:30', note: 'Snack sehat tengah malam' },
      { shift_type: '3', activity_name: 'Sarapan ringan (setelah kerja)', time_start: '07:30', reminder_time: '07:00', note: 'Supaya tidur tidak lapar' },
      { shift_type: '3', activity_name: 'Tidur utama', time_start: '08:00', reminder_time: '07:30', note: 'Gunakan masker mata / tirai gelap' },
    ]
  })
  console.log('✅ ShiftActivity data seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
