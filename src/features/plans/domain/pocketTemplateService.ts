import { pocketTemplateRepository } from "../data/PocketTemplateRepository.js";
import { prisma } from "../../../infrastructure/database/prisma.js";
import type { Prisma } from "@prisma/client";

type Gagal = { success: false; status: number; message: string };
const gagal = (status: number, message: string): Gagal => ({ success: false, status, message });

type PocketTersimpan = {
  categoryId: string;
  limitType: "percentage" | "nominal";
  percentage: number | null;
  limitAmount: number | null;
  keywords: string[];
};

function bacaPockets(nilai: unknown): PocketTersimpan[] {
  return Array.isArray(nilai) ? (nilai as PocketTersimpan[]) : [];
}

function validasi(name: string, pockets: unknown): string | null {
  if (!name?.trim()) return "Nama template wajib diisi.";
  if (name.trim().length > 60) return "Nama template maksimal 60 karakter.";
  if (!Array.isArray(pockets) || pockets.length === 0) {
    return "Template harus berisi minimal satu kantong.";
  }
  return null;
}

export async function daftarTemplate(userId: string) {
  const templates = await pocketTemplateRepository.findByUser(userId);

  // Template menyimpan categoryId. Kategori bisa dihapus setelah template dibuat,
  // dan entri yang menunjuk kategori hilang harus dilewati saat diterapkan —
  // bukan gagal senyap, bukan pula gagal total. Jumlahnya dihitung di sini agar
  // frontend bisa memberi tahu pengguna sebelum menerapkan.
  const idKategori = new Set(
    (await prisma.budgetCategory.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true },
    })).map((k) => k.id)
  );

  return {
    success: true as const,
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

export async function simpanTemplate(userId: string, name: string, pockets: unknown) {
  const pesan = validasi(name, pockets);
  if (pesan) return gagal(400, pesan);

  const adaNamaSama = (await pocketTemplateRepository.findByUser(userId)).some(
    (t) => t.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (adaNamaSama) return gagal(409, "Sudah ada template dengan nama itu.");

  const dibuat = await pocketTemplateRepository.create(
    userId,
    name.trim(),
    pockets as Prisma.InputJsonValue
  );
  return { success: true as const, data: dibuat };
}

export async function ubahTemplate(
  userId: string,
  templateId: string,
  data: { name?: string; pockets?: unknown }
) {
  const template = await pocketTemplateRepository.findById(templateId);
  if (!template || template.userId !== userId) return gagal(404, "Template tidak ditemukan.");

  if (data.name != null && !data.name.trim()) return gagal(400, "Nama template wajib diisi.");
  if (data.pockets != null && (!Array.isArray(data.pockets) || data.pockets.length === 0)) {
    return gagal(400, "Template harus berisi minimal satu kantong.");
  }

  return {
    success: true as const,
    data: await pocketTemplateRepository.update(templateId, {
      ...(data.name != null ? { name: data.name.trim() } : {}),
      ...(data.pockets != null ? { pockets: data.pockets as Prisma.InputJsonValue } : {}),
    }),
  };
}

export async function hapusTemplate(userId: string, templateId: string) {
  const template = await pocketTemplateRepository.findById(templateId);
  if (!template || template.userId !== userId) return gagal(404, "Template tidak ditemukan.");
  await pocketTemplateRepository.remove(templateId);
  return { success: true as const, data: { id: templateId } };
}
