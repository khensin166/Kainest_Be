const MS_PER_MINUTE = 60000;
/**
 * Toleransi keterlambatan saat pembuatan jadwal pertama kali (15 menit).
 * Mencegah pengiriman reminder basi (mis. H-7 atau H-3) saat event yang sudah dekat
 * deadline baru pertama kali diimpor ke database.
 */
export const INITIAL_SCHEDULE_GRACE_MINUTES = 15;
/**
 * Aturan pengingat default BINUS LMS (termasuk H-7 sesuai permintaan user).
 */
export const DEFAULT_REMINDER_RULES = [
    // ASSIGNMENT (PAS:) -> acuan EndUtc
    { category: "ASSIGNMENT", offsetMinutes: -10080, label: "H-7", channel: "WHATSAPP", isActive: true },
    { category: "ASSIGNMENT", offsetMinutes: -4320, label: "H-3", channel: "WHATSAPP", isActive: true },
    { category: "ASSIGNMENT", offsetMinutes: -1440, label: "H-1", channel: "WHATSAPP", isActive: true },
    { category: "ASSIGNMENT", offsetMinutes: -180, label: "H-3 Jam", channel: "WHATSAPP", isActive: true },
    // GROUP_ASSIGNMENT (TAS:) -> acuan EndUtc
    { category: "GROUP_ASSIGNMENT", offsetMinutes: -10080, label: "H-7", channel: "WHATSAPP", isActive: true },
    { category: "GROUP_ASSIGNMENT", offsetMinutes: -4320, label: "H-3", channel: "WHATSAPP", isActive: true },
    { category: "GROUP_ASSIGNMENT", offsetMinutes: -1440, label: "H-1", channel: "WHATSAPP", isActive: true },
    { category: "GROUP_ASSIGNMENT", offsetMinutes: -180, label: "H-3 Jam", channel: "WHATSAPP", isActive: true },
    // QUIZ (Quiz: / QIZ:) -> acuan EndUtc
    { category: "QUIZ", offsetMinutes: -10080, label: "H-7", channel: "WHATSAPP", isActive: true },
    { category: "QUIZ", offsetMinutes: -1440, label: "H-1", channel: "WHATSAPP", isActive: true },
    { category: "QUIZ", offsetMinutes: -180, label: "H-3 Jam", channel: "WHATSAPP", isActive: true },
    // VIRTUAL_CONFERENCE (Virtual Class:) -> acuan StartUtc
    { category: "VIRTUAL_CONFERENCE", offsetMinutes: -1440, label: "H-1", channel: "WHATSAPP", isActive: true },
    { category: "VIRTUAL_CONFERENCE", offsetMinutes: -30, label: "H-30 Menit", channel: "WHATSAPP", isActive: true },
    // LECTURE_WEEKLY (Online: LEC) -> nonaktif default agar tidak spam
    { category: "LECTURE_WEEKLY", offsetMinutes: -1440, label: "H-1", channel: "WHATSAPP", isActive: false },
];
/**
 * Normalisasi nomor WhatsApp pribadi untuk GOWA (contoh: "0812..." / "+62812..." -> "62812...").
 * Jika sudah berupa JID (@s.whatsapp.net / @g.us), dikembalikan apa adanya.
 */
export function normalizeWhatsAppRecipient(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return "";
    if (trimmed.includes("@"))
        return trimmed;
    const digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("0")) {
        return `62${digits.slice(1)}`;
    }
    return digits;
}
/**
 * Menghitung daftar kandidat reminder untuk 1 event berdasarkan daftar rule aktif.
 */
export function calculateReminderCandidates(event, rules, defaultRecipient, now = new Date()) {
    if (event.isMuted) {
        return [];
    }
    // Event yang deadline/waktu mulainya sudah terlewat tidak perlu dijadwalkan
    if (event.referenceTimeUtc.getTime() <= now.getTime()) {
        return [];
    }
    const graceCutoffMs = now.getTime() - INITIAL_SCHEDULE_GRACE_MINUTES * MS_PER_MINUTE;
    const candidates = [];
    for (const rule of rules) {
        if (!rule.isActive || rule.category !== event.category) {
            continue;
        }
        const recipient = normalizeWhatsAppRecipient(rule.targetRecipient || defaultRecipient);
        if (!recipient) {
            continue;
        }
        const scheduledAtMs = event.referenceTimeUtc.getTime() + rule.offsetMinutes * MS_PER_MINUTE;
        if (scheduledAtMs < graceCutoffMs) {
            continue;
        }
        candidates.push({
            ruleId: rule.id,
            channel: rule.channel,
            recipient,
            scheduledAt: new Date(scheduledAtMs),
            eventVersionUtc: event.lastModifiedUtc,
        });
    }
    return candidates;
}
