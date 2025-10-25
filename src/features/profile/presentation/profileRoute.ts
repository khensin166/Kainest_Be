import { Hono } from 'hono'
import { authMiddleware } from '../../auth/presentation/authMiddleware.js'
import { getProfileController, updateProfileController } from '../services/profileController.js'

export const profileRoute = new Hono()

// Semua rute di sini dilindungi oleh authMiddleware
profileRoute.use('*', authMiddleware)

// GET /profile -> Mendapatkan data diri
profileRoute.get('/', getProfileController)

// PATCH /profile -> Update data diri
profileRoute.patch('/', updateProfileController)