import { todoRepository } from '../../data/TodoRepository.js'

export const deleteTodoUseCase = async (todoId: string, coupleId: string) => {
  try {
    // 1. Verifikasi kepemilikan
    const todo = await todoRepository.findTodoById(todoId);
    if (!todo) {
      return { success: false, status: 404, message: 'Todo not found' };
    }
    if (todo.coupleId !== coupleId) {
      return { success: false, status: 403, message: 'You are not authorized to delete this todo' };
    }

    // 2. Lakukan penghapusan
    await todoRepository.deleteTodo(todoId);
    return { success: true, message: 'Todo deleted successfully' };
  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: 'Failed to delete todo' };
  }
}