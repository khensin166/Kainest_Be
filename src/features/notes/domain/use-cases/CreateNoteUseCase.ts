import { noteRepository } from '../../data/NoteRepository.js'
import { Prisma, NotePermission } from '@prisma/client'

type CreateNoteData = {
  title: string;
  content: Prisma.JsonValue;
  is_public: boolean;
  authorId: string;
  coupleId?: string | null;
  partnerPermission?: NotePermission;
}

export const createNoteUseCase = async (data: CreateNoteData) => {
  if (!data.title) {
    return { success: false, status: 400, message: 'Title is required' };
  }
  
  try {
    const newNote = await noteRepository.createNote({
      title: data.title,
      content: data.content,
      is_public: data.is_public || false, // Pastikan ada default
      authorId: data.authorId,
      coupleId: data.coupleId,
      partnerPermission: data.partnerPermission || 'VIEWER', 
    });
    return { success: true, data: newNote };
  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: 'Failed to create note' };
  }
}