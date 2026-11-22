import { pocketTemplateRepository } from "../data/PocketTemplateRepository.js";
import { prisma } from "../../../infrastructure/database/prisma.js";
const gagal = (status, message) => ({ success: false, status, message });
function bacaPockets(nilai) {
    return Array.isArray(nilai) ? nilai : [];
}
function validasi(name, pockets) {
    if (!name?.trim())
        return "Nama template wajib diisi.";
    if (name.trim().length > 60)
        return "Nama template maksimal 60 karakter.";
    if (!Array.isArray(pockets) || pockets.length === 0) {
        return "Template harus berisi minimal satu kantong.";
    }
    return null;
}
export async function daftarTemplate(userId) {
    const templates = await pocketTemplateRepository.findByUser(userId);
    // Template menyimpan categoryId. Kategori bisa dihapus setelah template dibuat,
    // dan entri yang menunjuk kategori hilang harus dilewati saat diterapkan —
    // bukan gagal senyap, bukan pula gagal total. Jumlahnya dihitung di sini agar
    // frontend bisa memberi tahu pengguna sebelum menerapkan.
    const idKategori = new Set((await prisma.budgetCategory.findMany({
        where: { OR: [{ userId }, { userId: null }] },
        select: { id: true },
    })).map((k) => k.id));
    return {
        success: true,
        data: templates.map((t) => {
            const pockets = bacaPockets(t.pockets);
            const hilang = pockets.filter((p) => !idKategori.has(p.categoryId)).length;
            return {
                id: t.id,
                name: t.name,
                pockets,
                pocketCount: pockets.length,
                missingCategoryCount: hilang,
                updatedAt: t.updatedAt,
            };
        }),
    };
}
export async function simpanTemplate(userId, name, pockets) {
    const pesan = validasi(name, pockets);
    if (pesan)
        return gagal(400, pesan);
    const adaNamaSama = (await pocketTemplateRepository.findByUser(userId)).some((t) => t.name.toLowerCase() === name.trim().toLowerCase());
    if (adaNamaSama)
        return gagal(409, "Sudah ada template dengan nama itu.");
    const dibuat = await pocketTemplateRepository.create(userId, name.trim(), pockets);
    return { success: true, data: dibuat };
}
export async function ubahTemplate(userId, templateId, data) {
    const template = await pocketTemplateRepository.findById(templateId);
    if (!template || template.userId !== userId)
        return gagal(404, "Template tidak ditemukan.");
    if (data.name != null && !data.name.trim())
        return gagal(400, "Nama template wajib diisi.");
    if (data.pockets != null && (!Array.isArray(data.pockets) || data.pockets.length === 0)) {
        return gagal(400, "Template harus berisi minimal satu kantong.");
    }
    return {
        success: true,
        data: await pocketTemplateRepository.update(templateId, {
            ...(data.name != null ? { name: data.name.trim() } : {}),
            ...(data.pockets != null ? { pockets: data.pockets } : {}),
        }),
    };
}
export async function hapusTemplate(userId, templateId) {
    const template = await pocketTemplateRepository.findById(templateId);
    if (!template || template.userId !== userId)
        return gagal(404, "Template tidak ditemukan.");
    await pocketTemplateRepository.remove(templateId);
    return { success: true, data: { id: templateId } };
}
