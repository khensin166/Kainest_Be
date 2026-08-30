import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import {
  getBillsController,
  getUpcomingBillsController,
  createBillController,
  updateBillController,
  deleteBillController,
  payBillController,
  skipBillController,
  cancelBillPaymentController,
  getGoalsController,
  createGoalController,
  updateGoalController,
  deleteGoalController,
  updateGoalStatusController,
  contributeGoalController,
  getContributionsController,
  getHealthController,
  getTemplatesController,
  createTemplateController,
  updateTemplateController,
  deleteTemplateController,
} from "../services/plansController.js";

export const plansRoute = new Hono();

plansRoute.use("*", authMiddleware);

// ==========================================
// 🔔 TAGIHAN & CICILAN
// ==========================================

// Daftar tagihan + status siklus berjalan (upcoming/overdue/paid/skipped)
plansRoute.get("/bills", getBillsController);

// Ringkas untuk widget dashboard dan bot. ?days=7
plansRoute.get("/bills/upcoming", getUpcomingBillsController);

plansRoute.post("/bills", createBillController);
plansRoute.put("/bills/:id", updateBillController);
plansRoute.delete("/bills/:id", deleteBillController);

// Tandai lunas -> membuat Transaction (EXPENSE) + BillPayment
plansRoute.post("/bills/:id/pay", payBillController);

// Lewati bulan ini -> BillPayment tanpa Transaction, budget tidak berkurang
plansRoute.post("/bills/:id/skip", skipBillController);

// Batalkan penandaan siklus ini; transaksi terkait ikut terhapus
plansRoute.delete("/bills/:id/payment", cancelBillPaymentController);

// ==========================================
// 🏝️ WISHLIST TABUNGAN
// ==========================================

plansRoute.get("/goals", getGoalsController);
plansRoute.post("/goals", createGoalController);
plansRoute.put("/goals/:id", updateGoalController);
plansRoute.delete("/goals/:id", deleteGoalController);
plansRoute.patch("/goals/:id/status", updateGoalStatusController);

// Setor; nominal negatif = penarikan
plansRoute.post("/goals/:id/contribute", contributeGoalController);
plansRoute.get("/goals/:id/contributions", getContributionsController);

// ==========================================
// 🟢 PENJAGA SOLVABILITAS
// ==========================================

plansRoute.get("/health", getHealthController);

// ==========================================
// 📋 TEMPLATE KANTONG
// ==========================================

plansRoute.get("/pocket-templates", getTemplatesController);
plansRoute.post("/pocket-templates", createTemplateController);
plansRoute.put("/pocket-templates/:id", updateTemplateController);
plansRoute.delete("/pocket-templates/:id", deleteTemplateController);
