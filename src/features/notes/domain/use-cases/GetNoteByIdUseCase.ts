import { noteRepository } from '../../data/NoteRepository.js'

/**
 * Logika ini memeriksa apakah user boleh mengakses note ini.
 */
export const getNoteByIdUseCase = async (noteId: string, userId: string, coupleId: string | null) => {
  try {
    const note = await noteRepository.findNoteById(noteId);
    if (!note) {
      return { success: false, status: 404, message: 'Note not found' };
    }

    // Cek Otorisasi:
    // 1. Apakah note ini publik?
    if (note.is_public) {
      return { success: true, data: note };
    }
    // 2. Apakah saya penulisnya?
    if (note.authorId === userId) {
      return { success: true, data: note };
    }
    // 3. Apakah note ini dibagikan ke pasangan saya?
    if (note.coupleId && note.coupleId === coupleId) {
      return { success: true, data: note };
    }

    // Jika tidak satupun, jangan beri akses
    return { success: false, status: 403, message: 'You are not authorized to view this note' };

  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: 'Failed to get note' };
  }
}