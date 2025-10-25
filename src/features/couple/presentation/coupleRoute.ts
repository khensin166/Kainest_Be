import { Hono } from 'hono'
import { authMiddleware } from '../../auth/presentation/authMiddleware.js'
import { getCoupleStatusController, connectCoupleController } from '../services/coupleController.js'

export const coupleRoute = new Hono()

// Semua rute di sini dilindungi oleh authMiddleware
coupleRoute.use('*', authMiddleware)

// GET /couple -> Mendapatkan status koneksi pasangan
coupleRoute.get('/', getCoupleStatusController)

// POST /couple/connect -> Terhubung dengan pasangan pakai kode
coupleRoute.post('/connect', connectCoupleController)