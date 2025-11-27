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
  const categories = await budgetRepository.findAllCategories();
  return c.json({ success: true, data: categories });
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

  // Ambil query parameters dari URL (misal: ?page=1&limit=10&startDate=2025-11-01)
  const { page, limit, startDate, endDate } = c.req.query();

  const result = await getTransactionsUseCase({
    userId,
    page,
    limit,
    startDate,
    endDate,
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
