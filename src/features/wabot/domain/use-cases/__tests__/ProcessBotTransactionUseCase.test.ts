import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processBotTransactionUseCase } from '../ProcessBotTransactionUseCase.js';
import { botTransactionRepository } from '../../../data/BotTransactionRepository.js';
import { prisma } from '../../../../../infrastructure/database/prisma.js';

// Mock dependencies
vi.mock('../../../data/BotTransactionRepository.js', () => ({
  botTransactionRepository: {
    getUserByInvitationCode: vi.fn(),
    updateWhatsappJid: vi.fn(),
  },
}));

vi.mock('../../../../../infrastructure/database/prisma.js', () => ({
  prisma: {
    botActiveGroup: {
      upsert: vi.fn(),
    },
  },
}));

describe('ProcessBotTransactionUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('!link command', () => {
    it('should return error if code is not provided', async () => {
      // Act
      const result = await processBotTransactionUseCase({
        type: 'text',
        text: '!link',
        sender: '6281234567890@s.whatsapp.net'
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Format salah');
    });

    it('should return error if user is not found', async () => {
      // Arrange
      vi.mocked(botTransactionRepository.getUserByInvitationCode).mockResolvedValue(null);

      // Act
      const result = await processBotTransactionUseCase({
        type: 'text',
        text: '!link INVALIDCODE',
        sender: '6281234567890@s.whatsapp.net'
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toContain('Kode tidak valid');
    });

    it('should link user and activate group if sent from a group', async () => {
      // Arrange
      const mockUser = { id: 'user-123', name: 'Budi' };
      vi.mocked(botTransactionRepository.getUserByInvitationCode).mockResolvedValue(mockUser as any);
      vi.mocked(botTransactionRepository.updateWhatsappJid).mockResolvedValue(undefined as any);
      vi.mocked(prisma.botActiveGroup.upsert).mockResolvedValue(undefined as any);

      // Act
      const result = await processBotTransactionUseCase({
        type: 'text',
        text: '!link VALIDCODE',
        sender: '6281234567890@s.whatsapp.net',
        groupId: 'group-123@g.us'
      });

      // Assert
      expect(result.success).toBe(true);
      expect(botTransactionRepository.updateWhatsappJid).toHaveBeenCalledWith('user-123', '6281234567890');
      expect(prisma.botActiveGroup.upsert).toHaveBeenCalledWith({
        where: { groupId: 'group-123@g.us' },
        create: { groupId: 'group-123@g.us', userId: 'user-123' },
        update: { userId: 'user-123' }
      });
      expect(result.data?.message).toContain('berhasil terhubung & Grup ini langsung AKTIF!');
    });
  });
});
