import { Context } from "hono";
import { createTransactionUseCase } from "../domain/use-cases/CreateTransactionUseCase.js";
import { getDailyBudgetStatusUseCase } from "../domain/use-cases/GetDailyBudgetStatusUseCase.js";
import { setupMonthlyBudgetUseCase } from "../domain/use-cases/SetupMonthlyBudgetUseCase.js";
import { getMonthlySummaryUseCase } from "../domain/use-cases/GetMonthlySummaryUseCase.js";
import { getAiAdvisorUseCase } from "../domain/use-cases/GetAiAdvisorUseCase.js";
import { evaluateMonthlyBudgetUseCase } from "../domain/use-cases/EvaluateMonthlyBudgetUseCase.js";
import { budgetRepository } from "../data/BudgetRepository.js";

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
