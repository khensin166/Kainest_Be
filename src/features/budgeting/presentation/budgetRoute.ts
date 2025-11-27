import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import {
  createTransactionController,
  getBudgetStatusController,
  getCategoriesController,
  setupBudgetController,
  getSummaryController,
  getAiAdviceController,
  seedCategoriesController,
  evaluateBudgetController,
  getTrendController,
  getTransactionsController,
  getTransactionDetailController,
  updateTransactionController,
  deleteTransactionController,
} from "../services/budgetController.js";

export const budgetRoute = new Hono();

// Middleware Auth (Wajib Login)
budgetRoute.use("*", authMiddleware);

// 1. Ambil daftar kategori (untuk dropdown)
budgetRoute.get("/categories", getCategoriesController);

// 2. Input Transaksi Baru
budgetRoute.post("/transactions", createTransactionController);

// BARU: GET /api/budget/transactions (Read List)
budgetRoute.get("/transactions", getTransactionsController);

// GET Detail
budgetRoute.get("/transactions/:id", getTransactionDetailController);

// PUT Update
budgetRoute.put("/transactions/:id", updateTransactionController);

// DELETE Hapus
budgetRoute.delete("/transactions/:id", deleteTransactionController);

// 3. Cek Status Budget (Hitung Zone Hijau/Merah)
// Frontend panggil ini saat user pilih kategori "Makan" di dashboard
budgetRoute.get("/status/:categoryId", getBudgetStatusController);

// Setup Budget Awal (POST)
budgetRoute.post("/setup", setupBudgetController);

// Ambil Summary Bulanan (GET) -> Dashboard Utama
budgetRoute.get("/summary", getSummaryController);

// GET /api/budget/advisor/:categoryId
// Frontend memanggil ini saat user klik tombol "Minta Saran AI" atau saat loading dashboard
budgetRoute.get("/advisor/:categoryId", getAiAdviceController);

// POST /api/budget/seed-categories (Hanya dijalankan sekali oleh Admin/Dev)
budgetRoute.post("/seed-categories", seedCategoriesController);

// POST /api/budget/evaluate
// Dipanggil saat tombol "Tutup Buku Bulan Ini" ditekan user
budgetRoute.post("/evaluate", evaluateBudgetController);

// Ambil Data Tren Harian (GET) -> Untuk Grafik Dashboard
budgetRoute.get("/trend", getTrendController);
