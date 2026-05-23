import { todoRepository } from '../../data/TodoRepository.js';
export const updateTodoUseCase = async (todoId, coupleId, data) => {
    try {
        // 1. Verifikasi kepemilikan
        const todo = await todoRepository.findTodoById(todoId);
        if (!todo) {
            return { success: false, status: 404, message: 'Todo not found' };
        }
        if (todo.coupleId !== coupleId) {
            return { success: false, status: 403, message: 'You are not authorized to edit this todo' };
        }
        // 2. Lakukan update
        const updatedTodo = await todoRepository.updateTodo(todoId, data);
        return { success: true, data: updatedTodo };
    }
    catch (error) {
        console.error(error);
        return { success: false, status: 500, message: 'Failed to update todo' };
    }
};
