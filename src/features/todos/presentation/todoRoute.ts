import { Hono } from 'hono'
import { authMiddleware } from '../../auth/presentation/authMiddleware.js'
import { 
  getTodosController,
  createTodoController,
  updateTodoController,
  deleteTodoController
} from '../services/todoController.js'

export const todoRoute = new Hono()

// Lindungi semua rute to-do dengan authMiddleware
todoRoute.use('*', authMiddleware)

// GET /todos -> Ambil semua to-do
todoRoute.get('/', getTodosController)

// POST /todos -> Buat to-do baru
todoRoute.post('/', createTodoController)

// PATCH /todos/:id -> Update to-do (termasuk toggle is_completed)
todoRoute.patch('/:id', updateTodoController)

// DELETE /todos/:id -> Hapus to-do
todoRoute.delete('/:id', deleteTodoController)