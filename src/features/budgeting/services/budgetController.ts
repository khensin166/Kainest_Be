import { Context } from "hono";
import { createTransactionUseCase } from "../domain/use-cases/CreateTransactionUseCase.js";
import { getDailyBudgetStatusUseCase } from "../domain/use-cases/GetDailyBudgetStatusUseCase.js";
import { setupMonthlyBudgetUseCase } from "../domain/use-cases/SetupMonthlyBudgetUseCase.js";
import { getMonthlySummaryUseCase } from "../domain/use-cases/GetMonthlySummaryUseCase.js";
import { getAiAdvisorUseCase } from "../domain/use-cases/GetAiAdvisorUseCase.js";
import { getSpendingTrendUseCase } from "../domain/use-cases/GetSpendingTrendUseCase.js";
import { evaluateMonthlyBudgetUseCase } from "../domain/use-cases/EvaluateMonthlyBudgetUseCase.js";
import { budgetRepository } from "../data/BudgetRepository.js";
import { getTransactionsUseCase } from "../domain/use-cases/GetTransactionsUseCase.js";
import { getTransactionDetailUseCase } from "../domain/use-cases/GetTransactionDetailUseCase.js";
import { updateTransactionUseCase } from "../domain/use-cases/UpdateTransactionUseCase.js";
import { deleteTransactionUseCase } from "../domain/use-cases/DeleteTransactionUseCase.js";
import { getPocketsUseCase } from "../domain/use-cases/GetPocketsUseCase.js";
import { upsertPocketUseCase } from "../domain/use-cases/UpsertPocketUseCase.js";
import { deletePocketUseCase } from "../domain/use-cases/DeletePocketUseCase.js";
import { bulkSetupPocketsUseCase } from "../domain/use-cases/BulkSetupPocketsUseCase.js";
import { updateCategoryKeywordsUseCase } from "../domain/use-cases/UpdateCategoryKeywordsUseCase.js";
import { classifyTransactionUseCase } from "../domain/use-cases/ClassifyTransactionUseCase.js";
// === Create Transaction ===
export const createTransactionController = async (c: Context) => {
  const userId = c.get("userId"); // Dari authMiddleware
  const body = await c.req.json();

  const result = await createTransactionUseCase({
    userId,
    amount: body.amount,
    categoryId: body.categoryId,
    note: body.note,
    date: body.date,
  });

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

// === Get Daily Zone Status (UI Utama) ===
export const getBudgetStatusController = async (c: Context) => {
  const userId = c.get("userId");
  const categoryId = c.req.param("categoryId");

  const result = await getDailyBudgetStatusUseCase(userId, categoryId);

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

// === Helper: Get Categories (Dropdown) ===
export const getCategoriesController = async (c: Context) => {
  const userId = c.get("userId");
  const categories = await budgetRepository.findAllCategories(userId);
  return c.json({ success: true, data: categories });
};

// === POST: Buat Kategori Kustom ===
export const createCustomCategoryController = async (c: Context) => {
  const userId = c.get("userId");
  const body = await c.req.json();

  if (!body.name || !body.icon) {
    return c.json({ success: false, message: "Name and icon are required" }, 400);
  }

  try {
    const category = await budgetRepository.createCustomCategory(userId, body.name, body.icon);
    return c.json({ success: true, data: category, message: "Kategori berhasil dibuat" });
  } catch (error) {
    console.error("Create Custom Category Error:", error);
    return c.json({ success: false, message: "Gagal membuat kategori" }, 500);
  }
};

// === Setup Budget (Biasanya dipanggil saat Onboarding) ===
export const setupBudgetController = async (c: Context) => {
  const userId = c.get("userId");
  const body = await c.req.json();

  const result = await setupMonthlyBudgetUseCase({
    userId,
    salary: body.salary,
    rentAmount: body.rent,
    savingTargetPercent: body.savingPercent,
  });

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === Get Dashboard Summary ===
export const getSummaryController = async (c: Context) => {
  const userId = c.get("userId");

  const result = await getMonthlySummaryUseCase(userId);

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

export const getAiAdviceController = async (c: Context) => {
  const userId = c.get("userId");
  const categoryId = c.req.param("categoryId");

  const result = await getAiAdvisorUseCase(userId, categoryId);

  if (!result.success) c.status(500);
  return c.json(result);
};

export const seedCategoriesController = async (c: Context) => {
  try {
    const result = await budgetRepository.seedDefaultCategories();
    return c.json({
      success: true,
      message: "Categories seeded",
      data: result,
    });
  } catch (error) {
    return c.json({ success: false, message: "Failed to seed" }, 500);
  }
};

export const evaluateBudgetController = async (c: Context) => {
  const userId = c.get("userId");
  const result = await evaluateMonthlyBudgetUseCase(userId);

  if (!result.success) c.status(500);
  return c.json(result);
};

// === Get Daily Trend untuk Grafik ===
export const getTrendController = async (c: Context) => {
  const userId = c.get("userId");

  const result = await getSpendingTrendUseCase(userId);

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === Get List Transactions (dengan filter & pagination) ===
export const getTransactionsController = async (c: Context) => {
  const userId = c.get("userId");

  // URL contoh: /budget/transactions?page=1&limit=10&search=soto
  const { page, limit, startDate, endDate, search } = c.req.query();

  const result = await getTransactionsUseCase({
    userId,
    page,
    limit,
    startDate,
    endDate,
    search,
  });

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === GET Detail Transaction (:id) ===
export const getTransactionDetailController = async (c: Context) => {
  const userId = c.get("userId");
  const transactionId = c.req.param("id"); // Ambil ID dari URL

  const result = await getTransactionDetailUseCase(transactionId, userId);

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === PUT Update Transaction (:id) ===
export const updateTransactionController = async (c: Context) => {
  const userId = c.get("userId");
  const transactionId = c.req.param("id");
  const body = await c.req.json(); // Ambil data update dari body

  const result = await updateTransactionUseCase(transactionId, userId, body);

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === DELETE Transaction (:id) ===
export const deleteTransactionController = async (c: Context) => {
  const userId = c.get("userId");
  const transactionId = c.req.param("id");

  const result = await deleteTransactionUseCase(transactionId, userId);

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// ==========================================
// 💰 POCKET (KANTONG) CONTROLLERS
// ==========================================

// === GET: Ambil semua kantong user ===
export const getPocketsController = async (c: Context) => {
  const userId = c.get("userId");
  const result = await getPocketsUseCase(userId);

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === PUT: Buat/update satu kantong ===
export const upsertPocketController = async (c: Context) => {
  const userId = c.get("userId");
  const body = await c.req.json();

  const result = await upsertPocketUseCase({
    userId,
    categoryId: body.categoryId,
    percentage: body.percentage,
    limitAmount: body.limitAmount,
  });

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === DELETE: Hapus kantong ===
export const deletePocketController = async (c: Context) => {
  const userId = c.get("userId");
  const categoryId = c.req.param("categoryId");

  const result = await deletePocketUseCase(userId, categoryId);

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === POST: Bulk setup kantong (untuk onboarding) ===
export const bulkSetupPocketsController = async (c: Context) => {
  const userId = c.get("userId");
  const body = await c.req.json();

  const result = await bulkSetupPocketsUseCase({
    userId,
    pockets: body.pockets,
  });

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === PATCH: Update keywords kategori ===
export const updateKeywordsController = async (c: Context) => {
  const categoryId = c.req.param("categoryId");
  const body = await c.req.json();

  const result = await updateCategoryKeywordsUseCase(categoryId, body.keywords);

  if (!result.success) c.status(result.status as any);
  return c.json(result);
};

// === POST: Klasifikasi teks pengeluaran via AI ===
export const classifyTransactionController = async (c: Context) => {
  const userId = c.get("userId");
  const body = await c.req.json();

  if (!body.text) {
    return c.json({ success: false, message: "Teks pengeluaran wajib diisi." }, 400);
  }

  const result = await classifyTransactionUseCase(userId, body.text);

  if (!result.success) c.status(500);
  return c.json(result);
};
