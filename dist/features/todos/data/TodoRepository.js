import { prisma } from '../../../infrastructure/database/prisma.js';
export const todoRepository = {
    /**
     * Mengambil semua to-do berdasarkan ID pasangan
     */
    async findTodosByCoupleId(coupleId) {
        return prisma.todo.findMany({
            where: { coupleId: coupleId },
            orderBy: { createdAt: 'desc' }, // Tampilkan yang terbaru di atas
            take: 50
        });
    },
    /**
     * Membuat to-do baru untuk pasangan
     */
    async createTodo(data) {
        return prisma.todo.create({
            data: {
                title: data.title,
                description: data.description,
                createdById: data.createdById,
                coupleId: data.coupleId,
            }
        });
    },
    /**
     * Mengambil satu to-do untuk verifikasi kepemilikan
     */
    async findTodoById(todoId) {
        return prisma.todo.findUnique({
            where: { id: todoId }
        });
    },
    /**
     * Meng-update sebuah to-do
     */
    async updateTodo(todoId, data) {
        return prisma.todo.update({
            where: { id: todoId },
            data: {
                title: data.title,
                description: data.description,
                is_completed: data.is_completed,
            }
        });
    },
    /**
     * Menghapus sebuah to-do
     */
    async deleteTodo(todoId) {
        return prisma.todo.delete({
            where: { id: todoId }
        });
    }
};
