// src/features/notes/data/NoteRepository.ts
import { prisma } from "../../../infrastructure/database/prisma.js";
export const noteRepository = {
    /**
     * Membuat Note baru
     */
    async createNote(data) {
        return prisma.note.create({
            data: {
                title: data.title,
                content: data.content,
                is_public: data.is_public,
                authorId: data.authorId,
                coupleId: data.coupleId,
                partnerPermission: data.partnerPermission,
            },
        });
    },
    /**
     * Mengambil semua notes untuk seorang user:
     * 1. Notes pribadi (authorId = userId, coupleId = null)
     * 2. Notes pasangan (coupleId = coupleId)
     */
    async findNotesByUser(userId, coupleId) {
        return prisma.note.findMany({
            where: {
                OR: [
                    // 1. Note pribadi saya
                    { authorId: userId, coupleId: null },
                    // 2. Note bersama pasangan (termasuk yang saya buat)
                    { coupleId: coupleId },
                ],
            },
            orderBy: { updatedAt: "desc" },
            // Hanya ambil data yang perlu untuk daftar list
            select: {
                id: true,
                title: true,
                updatedAt: true,
                is_public: true,
                authorId: true,
            },
        });
    },
    /**
     * Mengambil satu note lengkap berdasarkan ID
     */
    async findNoteById(noteId) {
        return prisma.note.findUnique({
            where: { id: noteId },
        });
    },
    /**
     * Mengupdate Note
     */
    async updateNote(noteId, data) {
        return prisma.note.update({
            where: { id: noteId },
            data: {
                title: data.title,
                content: data.content,
                is_public: data.is_public,
            },
        });
    },
    /**
     * Mengupdate HANYA izin/status sharing dari sebuah Note
     */
    async updateNotePermissions(noteId, data) {
        return prisma.note.update({
            where: { id: noteId },
            data: {
                is_public: data.is_public,
                coupleId: data.coupleId,
                partnerPermission: data.partnerPermission,
            },
        });
    },
    /**
     * Menghapus Note
     */
    async deleteNote(noteId) {
        return prisma.note.delete({
            where: { id: noteId },
        });
    },
    /**
     * (Untuk Nanti) Mengambil Note publik
     */
    async findPublicNoteById(noteId) {
        return prisma.note.findFirst({
            where: {
                id: noteId,
                is_public: true,
            },
            // Ambil data penulis untuk ditampilkan
            include: {
                author: {
                    select: {
                        name: true,
                        profile: { select: { displayName: true, avatarUrl: true } },
                    },
                },
            },
        });
    },
};
