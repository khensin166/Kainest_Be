import { Context } from "hono";
import { coupleRepository } from "../../couple/data/CoupleRepository.js";
import { getTodosUseCase } from "../domain/use-cases/GetTodosUseCase.js";
import { createTodoUseCase } from "../domain/use-cases/CreateTodoUseCase.js";
import { updateTodoUseCase } from "../domain/use-cases/UpdateTodoUseCase.js";
import { deleteTodoUseCase } from "../domain/use-cases/DeleteTodoUseCase.js";

/**
 * Helper internal yang HANYA mengambil coupleId atau null
 */
const getCoupleId = async (c: Context): Promise<string | null> => {
  const userId = c.get("userId");
  const couple = await coupleRepository.findCoupleByUserId(userId);
  if (!couple) {
    return null; // <-- Kembalikan null, JANGAN c.json()
  }
  return couple.id; // <-- Kembalikan string
};

// === CONTROLLERS ===

export const getTodosController = async (c: Context) => {
  // 1. Ambil ID
  const coupleId = await getCoupleId(c);

  // 2. Controller mengambil keputusan
  if (!coupleId) {
    c.status(403);
    return c.json({
      success: false,
      message: "You must be connected to a partner to use this feature.",
    });
  }

  // 3. 'coupleId' di sini dijamin string
  const result = await getTodosUseCase(coupleId);
  return c.json(result);
};

export const createTodoController = async (c: Context) => {
  const userId = c.get("userId");
  const coupleId = await getCoupleId(c);

  // 2. Controller mengambil keputusan
  if (!coupleId) {
    c.status(403);
    return c.json({
      success: false,
      message: "You must be connected to a partner to use this feature.",
    });
  }

  const body = await c.req.json();

  // 3. 'coupleId' di sini dijamin string
  const result = await createTodoUseCase({
    title: body.title,
    description: body.description,
    createdById: userId,
    coupleId: coupleId,
  });

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

export const updateTodoController = async (c: Context) => {
  const coupleId = await getCoupleId(c);

  // 2. Controller mengambil keputusan
  if (!coupleId) {
    c.status(403);
    return c.json({
      success: false,
      message: "You must be connected to a partner to use this feature.",
    });
  }

  const todoId = c.req.param("id");
  const body = await c.req.json();

  // 3. 'coupleId' di sini dijamin string
  const result = await updateTodoUseCase(todoId, coupleId, {
    title: body.title,
    description: body.description,
    is_completed: body.is_completed,
  });

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

export const deleteTodoController = async (c: Context) => {
  const coupleId = await getCoupleId(c);

  // 2. Controller mengambil keputusan
  if (!coupleId) {
    c.status(403);
    return c.json({
      success: false,
      message: "You must be connected to a partner to use this feature.",
    });
  }

  const todoId = c.req.param("id");

  // 3. 'coupleId' di sini dijamin string
  const result = await deleteTodoUseCase(todoId, coupleId);

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};
