import { noteRepository } from '../../data/NoteRepository.js'
import { NotePermission } from '@prisma/client'

type PermissionsData = {
  is_public: boolean;
  // Ini adalah 'coupleId' milik user, BUKAN 'shareWithPartner'
  coupleId: string | null; 
  partnerPermission: NotePermission;
}

export const updateNotePermissionsUseCase = async (noteId: string, userId: string, data: PermissionsData) => {
  try {
    // 1. Verifikasi kepemilikan
    const note = await noteRepository.findNoteById(noteId);
    if (!note) {
      return { success: false, status: 404, message: 'Note not found' };
    }
    
    // HANYA PENULIS (AUTHOR) YANG BOLEH MENGUBAH IZIN
    if (note.authorId !== userId) {
      return { success: false, status: 403, message: 'Only the author can change sharing settings' };
    }

    // 2. Tentukan data update
    // Jika 'is_public' true, paksa 'coupleId' jadi null (tidak bisa publik dan shared bersamaan)
    // (Ini adalah contoh aturan bisnis, Anda bisa sesuaikan)
    const effectiveCoupleId = data.is_public ? null : data.coupleId;

    // 3. Lakukan update
    const updatedNote = await noteRepository.updateNotePermissions(noteId, {
      is_public: data.is_public,
      coupleId: effectiveCoupleId,
      partnerPermission: data.partnerPermission || 'VIEWER' // Default
    });
    
    return { success: true, data: updatedNote };

  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: 'Failed to update permissions' };
  }
}