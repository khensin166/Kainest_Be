import { describe, it, expect, vi, beforeEach } from 'vitest';
import { groqService } from '../groqService.js';
import { prisma } from '../../database/prisma.js';

// Use vi.hoisted so it gets initialized before vi.mock
const { mockCreate } = vi.hoisted(() => {
  return { mockCreate: vi.fn() };
});

vi.mock('groq-sdk', () => {
  return {
    Groq: class {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

vi.mock('../../database/prisma.js', () => ({
  prisma: {
    apiUsageLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

// We need to import the mocked instance to change its implementation per test
import { Groq } from 'groq-sdk';

describe('groqService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateResponse', () => {
    it('should strip closed <think> tags correctly', async () => {
      // Arrange
      const rawResponse = "<think>Thinking process here...</think>\nHere is the valid response.";
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: rawResponse } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      });

      // Act
      const result = await groqService.generateResponse('system prompt', 'user context');

      // Assert
      expect(result).toBe('Here is the valid response.');
      expect(prisma.apiUsageLog.create).toHaveBeenCalled();
    });

    it('should strip unclosed/truncated <think> tags correctly', async () => {
      // Arrange
      const rawResponse = "<think>Thinking process that got cut off due to token limits...";
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: rawResponse } }],
      });

      // Act
      const result = await groqService.generateResponse('system prompt', 'user context');

      // Assert
      expect(result).toBe('Maaf, saya sedang pusing.');
    });

    it('should fallback to the next model if the first one fails', async () => {
      // Arrange
      // First call fails, second call succeeds
      mockCreate
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success from fallback!' } }],
        });

      // Act
      const result = await groqService.generateResponse('system prompt', 'user context');

      // Assert
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result).toBe('Success from fallback!');
    });

    it('should return a fallback message if all models fail', async () => {
      // Arrange: mock all 4 models to fail
      mockCreate
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Fail 4'));

      // Act
      const result = await groqService.generateResponse('system prompt', 'user context');

      // Assert
      expect(mockCreate).toHaveBeenCalledTimes(4);
      expect(result).toBe('Maaf, layanan AI sedang sibuk. Coba lagi nanti.');
    });
  });
});
