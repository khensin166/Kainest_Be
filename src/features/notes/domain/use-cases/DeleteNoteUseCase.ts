import { noteRepository } from '../../data/NoteRepository.js'

export const deleteNoteUseCase = async (noteId: string, userId: string) => {
  try {
    // 1. Verifikasi kepemilikan
    const note = await noteRepository.findNoteById(noteId);
    if (!note) {
      return { success: false, status: 404, message: 'Note not found' };
    }
    // HANYA PENULIS (AUTHOR) YANG BOLEH MENGHAPUS
    if (note.authorId !== userId) {
      return { success: false, status: 403, message: 'You are not authorized to delete this note' };
    }

    // 2. Lakukan penghapusan
    await noteRepository.deleteNote(noteId);
    return { success: true, message: 'Note deleted successfully' };
  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: 'Failed to delete note' };
  }
}