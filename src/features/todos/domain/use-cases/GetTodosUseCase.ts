import { todoRepository } from '../../data/TodoRepository.js'

export const getTodosUseCase = async (coupleId: string) => {
  try {
    const todos = await todoRepository.findTodosByCoupleId(coupleId);
    return { success: true, data: todos };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to get todos' };
  }
}