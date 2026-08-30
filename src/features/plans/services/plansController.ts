import { Context } from "hono";
import * as bill from "../domain/billService.js";
import * as saving from "../domain/savingService.js";
import * as template from "../domain/pocketTemplateService.js";
import { ringkasanKesehatan } from "../domain/planHealthService.js";

/** Meneruskan status dari lapisan domain; sukses tetap 200. */
function balas(c: Context, hasil: { success: boolean; status?: number }) {
  if (!hasil.success && hasil.status) c.status(hasil.status as any);
  return c.json(hasil);
}

/** Tanggal dari body JSON; string kosong/tidak valid dianggap tidak diisi. */
function tanggal(nilai: unknown): Date | undefined {
  if (typeof nilai !== "string" || !nilai) return undefined;
  const d = new Date(nilai);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ==========================================
// Tagihan
// ==========================================

export const getBillsController = async (c: Context) =>
  balas(c, await bill.daftarTagihan(c.get("userId")));

export const getUpcomingBillsController = async (c: Context) => {
  const hari = Number(c.req.query("days") ?? 7);
  const hasil = await bill.daftarTagihan(c.get("userId"));
  if (!hasil.success) return balas(c, hasil);

  const batas = Number.isFinite(hari) ? hari : 7;
  const mendatang = hasil.data.bills
    .filter(
      (b) =>
        (b.cycleStatus === "upcoming" && (b.daysUntilDue ?? 0) <= batas) ||
        b.cycleStatus === "overdue"
    )
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));

  return c.json({ success: true, data: { cycle: hasil.data.cycle, bills: mendatang } });
};

export const createBillController = async (c: Context) => {
  const body = await c.req.json();
  return balas(
    c,
    await bill.buatTagihan(c.get("userId"), {
      categoryId: body.categoryId,
      name: body.name,
      amount: Number(body.amount),
      frequency: body.frequency ?? "MONTHLY",
      dueDay: Number(body.dueDay),
      dueMonth: body.dueMonth != null ? Number(body.dueMonth) : null,
      startDate: tanggal(body.startDate) ?? new Date(),
      totalInstallments:
        body.totalInstallments != null && body.totalInstallments !== ""
          ? Number(body.totalInstallments)
          : null,
      reminderDaysBefore:
        body.reminderDaysBefore != null ? Number(body.reminderDaysBefore) : undefined,
      note: body.note ?? null,
    })
  );
};

export const updateBillController = async (c: Context) => {
  const body = await c.req.json();
  const data: Record<string, unknown> = {};
  for (const kunci of ["categoryId", "name", "frequency", "note"]) {
    if (body[kunci] !== undefined) data[kunci] = body[kunci];
  }
  for (const kunci of ["amount", "dueDay", "dueMonth", "totalInstallments", "reminderDaysBefore"]) {
    if (body[kunci] !== undefined) {
      data[kunci] = body[kunci] === null || body[kunci] === "" ? null : Number(body[kunci]);
    }
  }
  if (body.startDate !== undefined) data.startDate = tanggal(body.startDate);
  if (body.status !== undefined) data.status = body.status;

  return balas(c, await bill.ubahTagihan(c.get("userId"), c.req.param("id"), data as any));
};

export const deleteBillController = async (c: Context) =>
  balas(c, await bill.hapusTagihan(c.get("userId"), c.req.param("id")));

export const payBillController = async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  return balas(
    c,
    await bill.lunasiTagihan(c.get("userId"), c.req.param("id"), {
      amount: body.amount != null ? Number(body.amount) : undefined,
      date: tanggal(body.date),
    })
  );
};

export const skipBillController = async (c: Context) =>
  balas(c, await bill.lewatiTagihan(c.get("userId"), c.req.param("id")));

export const cancelBillPaymentController = async (c: Context) =>
  balas(c, await bill.batalkanPenandaan(c.get("userId"), c.req.param("id")));

// ==========================================
// Wishlist tabungan
// ==========================================

export const getGoalsController = async (c: Context) =>
  balas(c, await saving.daftarWishlist(c.get("userId")));

export const createGoalController = async (c: Context) => {
  const body = await c.req.json();
  return balas(
    c,
    await saving.buatWishlist(c.get("userId"), {
      name: body.name,
      targetAmount: Number(body.targetAmount),
      monthlyAllocation: body.monthlyAllocation != null ? Number(body.monthlyAllocation) : 0,
      targetDate: tanggal(body.targetDate) ?? null,
      icon: body.icon ?? null,
    })
  );
};

export const updateGoalController = async (c: Context) => {
  const body = await c.req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.icon !== undefined) data.icon = body.icon;
  if (body.targetAmount !== undefined) data.targetAmount = Number(body.targetAmount);
  if (body.monthlyAllocation !== undefined) {
    data.monthlyAllocation = Number(body.monthlyAllocation);
  }
  if (body.targetDate !== undefined) data.targetDate = tanggal(body.targetDate) ?? null;

  return balas(c, await saving.ubahWishlist(c.get("userId"), c.req.param("id"), data as any));
};

export const deleteGoalController = async (c: Context) =>
  balas(c, await saving.hapusWishlist(c.get("userId"), c.req.param("id")));

export const updateGoalStatusController = async (c: Context) => {
  const body = await c.req.json();
  if (!["ACTIVE", "ACHIEVED", "ARCHIVED"].includes(body.status)) {
    return c.json({ success: false, message: "Status tidak dikenal." }, 400);
  }
  return balas(c, await saving.ubahStatusWishlist(c.get("userId"), c.req.param("id"), body.status));
};

export const contributeGoalController = async (c: Context) => {
  const body = await c.req.json();
  return balas(
    c,
    await saving.setorWishlist(c.get("userId"), c.req.param("id"), {
      amount: Number(body.amount),
      note: body.note ?? null,
      date: tanggal(body.date),
    })
  );
};

export const getContributionsController = async (c: Context) =>
  balas(c, await saving.riwayatSetoran(c.get("userId"), c.req.param("id")));

// ==========================================
// Solvabilitas
// ==========================================

export const getHealthController = async (c: Context) =>
  balas(c, await ringkasanKesehatan(c.get("userId")));

// ==========================================
// Template kantong
// ==========================================

export const getTemplatesController = async (c: Context) =>
  balas(c, await template.daftarTemplate(c.get("userId")));

export const createTemplateController = async (c: Context) => {
  const body = await c.req.json();
  return balas(c, await template.simpanTemplate(c.get("userId"), body.name, body.pockets));
};

export const updateTemplateController = async (c: Context) => {
  const body = await c.req.json();
  return balas(
    c,
    await template.ubahTemplate(c.get("userId"), c.req.param("id"), {
      name: body.name,
      pockets: body.pockets,
    })
  );
};

export const deleteTemplateController = async (c: Context) =>
  balas(c, await template.hapusTemplate(c.get("userId"), c.req.param("id")));
