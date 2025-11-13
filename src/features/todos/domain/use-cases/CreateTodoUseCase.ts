import { todoRepository } from '../../data/TodoRepository.js'

export const createTodoUseCase = async (data: { title: string, description?: string, createdById: string, coupleId: string }) => {
  if (!data.title) {
    return { success: false, status: 400, message: 'Title is required' };
  }
  
  try {
    const newTodo = await todoRepository.createTodo(data);
    return { success: true, data: newTodo };
  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: 'Failed to create todo' };
  }
}