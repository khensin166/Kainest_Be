// noteRoute.ts
import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import {
  getNotesController,
  createNoteController,
  getNoteByIdController,
  updateNoteController,
  deleteNoteController,
  getPublicNoteController,
  updateNotePermissionsController,
} from "../services/noteController.js";

export const noteRoute = new Hono();

// --- Rute Publik (Tidak perlu login) ---
// GET /notes/public/:id
noteRoute.get("/public/:id", getPublicNoteController);

// --- Rute Aman (Harus login) ---
noteRoute.use("*", authMiddleware);

// GET /notes -> Ambil daftar semua note (private + shared)
noteRoute.get("/", getNotesController);

// POST /notes -> Buat note baru
noteRoute.post("/", createNoteController);

// GET /notes/:id -> Ambil satu note (dengan cek otorisasi)
noteRoute.get("/:id", getNoteByIdController);

// PATCH /notes/:id -> Update note
noteRoute.patch("/:id", updateNoteController);

// PATCH /notes/:id/share -> Update IZIN note
noteRoute.patch("/:id/share", updateNotePermissionsController);

// DELETE /notes/:id -> Hapus note
noteRoute.delete("/:id", deleteNoteController);
