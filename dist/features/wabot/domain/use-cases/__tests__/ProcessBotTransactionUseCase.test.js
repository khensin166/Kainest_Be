import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processBotTransactionUseCase } from '../ProcessBotTransactionUseCase.js';
import { botTransactionRepository } from '../../../data/BotTransactionRepository.js';
import { prisma } from '../../../../../infrastructure/database/prisma.js';
import * as gowaService from '../../../../../utils/gowaService.js';
// Mock dependencies
vi.mock('../../../data/BotTransactionRepository.js', () => ({
    botTransactionRepository: {
        getUserByInvitationCode: vi.fn(),
        getUserByPhoneNumber: vi.fn(),
        getActiveGroup: vi.fn(),
        updateWhatsappJid: vi.fn(),
    },
}));
vi.mock('../../../../../infrastructure/database/prisma.js', () => ({
    prisma: {
        botActiveGroup: {
            upsert: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}));
vi.mock('../../../../../utils/gowaService.js', () => ({
    getGroupNameViaGowa: vi.fn().mockResolvedValue('Grup Keuangan Budi'),
    sendTextViaGowa: vi.fn(),
    sendTextViaGowaWithResult: vi.fn(),
}));
describe('ProcessBotTransactionUseCase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(gowaService.getGroupNameViaGowa).mockResolvedValue('Grup Keuangan Budi');
    });
    describe('Private chat (DM) policy', () => {
        it('should reply guide for hi kainest / ping kainest / hello kainest', async () => {
            for (const trigger of ['hi kainest', 'Ping Kainest', 'HELLO KAINEST']) {
                const result = await processBotTransactionUseCase({
                    type: 'text',
                    text: trigger,
                    sender: '6281234567890@s.whatsapp.net',
                });
                expect(result.success).toBe(true);
                expect(result.data?.message).toContain('Grup WhatsApp terdaftar');
            }
        });
        it('should reject !link sent via DM and direct user to group', async () => {
            const result = await processBotTransactionUseCase({
                type: 'text',
                text: '!link VALIDCODE',
                sender: '6281234567890@s.whatsapp.net',
            });
            expect(result.success).toBe(true);
            expect(result.data?.message).toContain('tidak bisa dilakukan di chat pribadi');
        });
        it('should silently ignore arbitrary private chat messages', async () => {
            const result = await processBotTransactionUseCase({
                type: 'text',
                text: 'makan siang 25k',
                sender: '6281234567890@s.whatsapp.net',
            });
            expect(result.isIgnored).toBe(true);
            expect(result.ignoreReason).toBe('private_chat_ignored');
        });
    });
    describe('Unregistered group policy & !link command', () => {
        it('should silently ignore normal messages in unregistered groups', async () => {
            vi.mocked(botTransactionRepository.getActiveGroup).mockResolvedValue(null);
            const result = await processBotTransactionUseCase({
                type: 'text',
                text: 'hai semua makan siang yuk',
                sender: '6281234567890@s.whatsapp.net',
                groupId: 'unregistered@g.us',
            });
            expect(result.isIgnored).toBe(true);
            expect(result.ignoreReason).toBe('unregistered_group_ignored');
        });
        it('should return error if code is not provided in !link', async () => {
            const result = await processBotTransactionUseCase({
                type: 'text',
                text: '!link',
                sender: '6281234567890@s.whatsapp.net',
                groupId: 'group-123@g.us',
            });
            expect(result.success).toBe(false);
            expect(result.message).toContain('Format salah');
        });
        it('should return error if user is not found', async () => {
            vi.mocked(botTransactionRepository.getUserByInvitationCode).mockResolvedValue(null);
            const result = await processBotTransactionUseCase({
                type: 'text',
                text: '!link INVALIDCODE',
                sender: '6281234567890@s.whatsapp.net',
                groupId: 'group-123@g.us',
            });
            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
            expect(result.message).toContain('Kode tidak valid');
        });
        it('should reject regular user linking a second group and show existing group name', async () => {
            vi.mocked(botTransactionRepository.getUserByInvitationCode).mockResolvedValue({
                id: 'user-123',
                name: 'Budi',
                role: 'user',
            });
            vi.mocked(prisma.botActiveGroup.findMany).mockResolvedValue([
                { id: '1', groupId: 'old-group@g.us', groupName: 'Keluarga Budi', userId: 'user-123' },
            ]);
            const result = await processBotTransactionUseCase({
                type: 'text',
                text: '!link VALIDCODE',
                sender: '6281234567890@s.whatsapp.net',
                groupId: 'new-group@g.us',
            });
            expect(result.success).toBe(false);
            expect(result.status).toBe(409);
            expect(result.message).toContain('Keluarga Budi');
            expect(result.message).toContain('!unlink');
        });
        it('should link user and activate group with groupName if under limit', async () => {
            const mockUser = { id: 'user-123', name: 'Budi', role: 'user' };
            vi.mocked(botTransactionRepository.getUserByInvitationCode).mockResolvedValue(mockUser);
            vi.mocked(prisma.botActiveGroup.findMany).mockResolvedValue([]);
            vi.mocked(botTransactionRepository.updateWhatsappJid).mockResolvedValue(undefined);
            vi.mocked(prisma.botActiveGroup.upsert).mockResolvedValue(undefined);
            const result = await processBotTransactionUseCase({
                type: 'text',
                text: '!link VALIDCODE',
                sender: '6281234567890@s.whatsapp.net',
                groupId: 'group-123@g.us',
            });
            expect(result.success).toBe(true);
            expect(botTransactionRepository.updateWhatsappJid).toHaveBeenCalledWith('user-123', '6281234567890');
            expect(prisma.botActiveGroup.upsert).toHaveBeenCalledWith({
                where: { groupId: 'group-123@g.us' },
                create: { groupId: 'group-123@g.us', userId: 'user-123', groupName: 'Grup Keuangan Budi' },
                update: { userId: 'user-123', groupName: 'Grup Keuangan Budi' },
            });
            expect(result.data?.message).toContain('Grup Keuangan Budi');
        });
        it('should unlink registered group when owner sends !unlink', async () => {
            vi.mocked(botTransactionRepository.getActiveGroup).mockResolvedValue({
                id: '1',
                groupId: 'group-123@g.us',
                groupName: 'Grup Keuangan Budi',
                userId: 'user-123',
            });
            vi.mocked(botTransactionRepository.getUserByPhoneNumber).mockResolvedValue({
                id: 'user-123',
                name: 'Budi',
                role: 'user',
                permissions: [],
            });
            vi.mocked(prisma.botActiveGroup.delete).mockResolvedValue({});
            const result = await processBotTransactionUseCase({
                type: 'text',
                text: '!unlink',
                sender: '6281234567890@s.whatsapp.net',
                groupId: 'group-123@g.us',
            });
            expect(result.success).toBe(true);
            expect(prisma.botActiveGroup.delete).toHaveBeenCalledWith({ where: { groupId: 'group-123@g.us' } });
            expect(result.data?.message).toContain('berhasil dilepas');
        });
    });
});
