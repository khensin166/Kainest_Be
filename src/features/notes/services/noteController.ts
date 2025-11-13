import { Context } from "hono";
import { coupleRepository } from "../../couple/data/CoupleRepository.js";
import { getNotesUseCase } from "../domain/use-cases/GetNotesUseCase.js";
import { createNoteUseCase } from "../domain/use-cases/CreateNoteUseCase.js";
import { getNoteByIdUseCase } from "../domain/use-cases/GetNoteByIdUseCase.js";
import { updateNoteUseCase } from "../domain/use-cases/UpdateNoteUseCase.js";
import { deleteNoteUseCase } from "../domain/use-cases/DeleteNoteUseCase.js";
import { updateNotePermissionsUseCase } from "../domain/use-cases/UpdateNotePermissionsUseCase.js";
import { noteRepository } from "../data/NoteRepository.js";
import { NotePermission } from "@prisma/client";

/**
 * Helper 'lembut' yang mengambil ID.
 * Mengembalikan 'coupleId' HANYA jika user terhubung.
 */
const getIds = async (c: Context) => {
  const userId = c.get("userId");
  const couple = await coupleRepository.findCoupleByUserId(userId);
  return { userId, coupleId: couple?.id || null };
};

// === CONTROLLERS ===

export const getNotesController = async (c: Context) => {
  const { userId, coupleId } = await getIds(c);
  const result = await getNotesUseCase(userId, coupleId);
  return c.json(result);
};

export const getNoteByIdController = async (c: Context) => {
  const { userId, coupleId } = await getIds(c);
  const noteId = c.req.param("id");

  const result = await getNoteByIdUseCase(noteId, userId, coupleId);

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

export const createNoteController = async (c: Context) => {
  const { userId, coupleId } = await getIds(c);
  const body = await c.req.json();

  // Jika 'shareWithPartner' true, set coupleId
  // Jika tidak, biarkan null (private note)
  const effectiveCoupleId = body.shareWithPartner === true ? coupleId : null;

  // 2. Tentukan izin
  let permission: NotePermission = "VIEWER"; // Default
  if (effectiveCoupleId && body.partnerPermission === "EDITOR") {
    permission = "EDITOR";
  }

  const result = await createNoteUseCase({
    title: body.title,
    content: body.content, // Ini adalah JSON dari Editor.js
    is_public: body.is_public || false,
    authorId: userId,
    coupleId: effectiveCoupleId,
    partnerPermission: permission,
  });

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

export const updateNoteController = async (c: Context) => {
  const { userId, coupleId } = await getIds(c);
  const noteId = c.req.param("id");
  const body = await c.req.json();

  const result = await updateNoteUseCase(noteId, userId, coupleId, {
    title: body.title,
    content: body.content,
    is_public: body.is_public,
  });

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

export const deleteNoteController = async (c: Context) => {
  const { userId } = await getIds(c);
  const noteId = c.req.param("id");

  const result = await deleteNoteUseCase(noteId, userId);

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};

// (Untuk Nanti) Controller Publik
export const getPublicNoteController = async (c: Context) => {
  const noteId = c.req.param("id");
  const result = await noteRepository.findPublicNoteById(noteId); // Panggil repo langsung

  if (!result) {
    c.status(404);
    return c.json({ success: false, message: "Note not found or is private" });
  }
  return c.json({ success: true, data: result });
};

export const updateNotePermissionsController = async (c: Context) => {
  const { userId, coupleId } = await getIds(c);
  const noteId = c.req.param("id");
  const body = await c.req.json();

  // Tentukan coupleId berdasarkan input 'shareWithPartner'
  const effectiveCoupleId = body.shareWithPartner === true ? coupleId : null;

  // Tentukan izin
  let permission: NotePermission = "VIEWER"; // Default
  if (effectiveCoupleId && body.partnerPermission === "EDITOR") {
    permission = "EDITOR";
  }

  const result = await updateNotePermissionsUseCase(noteId, userId, {
    is_public: body.is_public || false,
    coupleId: effectiveCoupleId,
    partnerPermission: permission,
  });

  if (!result.success) {
    c.status(result.status as any);
  }
  return c.json(result);
};
