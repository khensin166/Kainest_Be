import { noteRepository } from "../../data/NoteRepository.js";
import { Prisma } from "@prisma/client";
import { coupleRepository } from "../../../couple/data/CoupleRepository.js";

type NoteUpdateData = {
  title?: string;
  content?: Prisma.JsonValue;
  is_public?: boolean;
};

export const updateNoteUseCase = async (
  noteId: string,
  userId: string,
  coupleId: string | null,
  data: NoteUpdateData
) => {
  try {
    // 1. Verifikasi kepemilikan
    const note = await noteRepository.findNoteById(noteId);
    if (!note) {
      return { success: false, status: 404, message: "Note not found" };
    }
    // --- 3. LOGIKA KEAMANAN BARU ---
    const isAuthor = note.authorId === userId;
    const isPartnerEditor =
      note.coupleId === coupleId && // Apakah note ini milik pasangan?
      note.partnerPermission === "EDITOR"; // Dan apakah saya punya izin EDITOR?

    // JIKA BUKAN author DAN BUKAN partner editor, TOLAK
    if (!isAuthor && !isPartnerEditor) {
      return {
        success: false,
        status: 403,
        message: "You are not authorized to edit this note",
      };
    }
    // --- BATAS LOGIKA BARU ---

    // 2. Lakukan update
    const updatedNote = await noteRepository.updateNote(noteId, data);
    return { success: true, data: updatedNote };
  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: "Failed to update note" };
  }
};
