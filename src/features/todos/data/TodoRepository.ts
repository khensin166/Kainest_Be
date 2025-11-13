import { prisma } from '../../../infrastructure/database/prisma.js'

// Tipe data untuk membuat atau mengupdate to-do
type TodoData = {
  title: string;
  description?: string;
  is_completed?: boolean;
}

export const todoRepository = {

  /**
   * Mengambil semua to-do berdasarkan ID pasangan
   */
  async findTodosByCoupleId(coupleId: string) {
    return prisma.todo.findMany({
      where: { coupleId: coupleId },
      orderBy: { createdAt: 'desc' } // Tampilkan yang terbaru di atas
    });
  },

  /**
   * Membuat to-do baru untuk pasangan
   */
  async createTodo(data: { title: string, description?: string,  createdById: string, coupleId: string }) {
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
  async findTodoById(todoId: string) {
    return prisma.todo.findUnique({
      where: { id: todoId }
    });
  },

  /**
   * Meng-update sebuah to-do
   */
  async updateTodo(todoId: string, data: Partial<TodoData>) {
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
  async deleteTodo(todoId: string) {
    return prisma.todo.delete({
      where: { id: todoId }
    });
  }
}