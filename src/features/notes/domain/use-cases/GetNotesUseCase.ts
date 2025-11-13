import { noteRepository } from '../../data/NoteRepository.js'

export const getNotesUseCase = async (userId: string, coupleId: string | null) => {
  try {
    const notes = await noteRepository.findNotesByUser(userId, coupleId);
    return { success: true, data: notes };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to get notes' };
  }
}