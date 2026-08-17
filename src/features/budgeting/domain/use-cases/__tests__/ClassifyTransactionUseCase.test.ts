import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyTransactionUseCase } from '../ClassifyTransactionUseCase.js';
import { pocketRepository } from '../../../data/PocketRepository.js';
import { budgetRepository } from '../../../data/BudgetRepository.js';
import { groqService } from '../../../../../infrastructure/ai/groqService.js';

vi.mock('../../../data/PocketRepository.js', () => ({
  pocketRepository: {
    findPocketsForClassification: vi.fn(),
  },
}));

vi.mock('../../../data/BudgetRepository.js', () => ({
  budgetRepository: {
    findAllCategories: vi.fn(),
  },
}));

vi.mock('../../../../../infrastructure/ai/groqService.js', () => ({
  groqService: {
    generateResponse: vi.fn(),
  },
}));

describe('ClassifyTransactionUseCase', () => {
  const userId = 'user-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    vi.mocked(pocketRepository.findPocketsForClassification).mockResolvedValue([
      {
        id: 'pocket-1',
        name: 'Makan',
        keywords: ['makan', 'minum', 'soto'],
        category: { id: 'cat-makan', name: 'Makanan & Minuman', type: 'EXPENSE' }
      }
    ] as any);

    vi.mocked(budgetRepository.findAllCategories).mockResolvedValue([
      { id: 'cat-gaji', name: 'Gaji', type: 'INCOME' },
      { id: 'cat-makan', name: 'Makanan & Minuman', type: 'EXPENSE' },
      { id: 'cat-lain', name: 'Lain-lain', type: 'EXPENSE' } // Fallback
    ] as any);
  });

  it('should correctly classify an expense transaction', async () => {
    // Arrange
    const text = 'beli soto 16k';
    const mockAiResponse = JSON.stringify({
      categoryId: 'cat-makan',
      type: 'EXPENSE',
      amount: 16000,
      note: 'beli soto'
    });
    vi.mocked(groqService.generateResponse).mockResolvedValueOnce(mockAiResponse);

    // Act
    const result = await classifyTransactionUseCase(userId, text);

    // Assert
    expect(result.success).toBe(true);
    expect(result.type).toBe('EXPENSE');
    expect(result.amount).toBe(16000);
    expect(result.categoryId).toBe('cat-makan');
  });

  it('should cleanly parse JSON even if surrounded by markdown', async () => {
    // Arrange
    const text = 'gaji bulan ini 5jt';
    const mockAiResponse = `\`\`\`json\n{"categoryId": "cat-gaji", "type": "INCOME", "amount": 5000000, "note": "gaji bulan ini"}\n\`\`\``;
    vi.mocked(groqService.generateResponse).mockResolvedValueOnce(mockAiResponse);

    // Act
    const result = await classifyTransactionUseCase(userId, text);

    // Assert
    expect(result.success).toBe(true);
    expect(result.type).toBe('INCOME');
    expect(result.amount).toBe(5000000);
  });

  it('should gracefully fail when AI returns an error string instead of JSON', async () => {
    // Arrange
    const text = 'beli aneh aneh 50k';
    // groqService fallback message
    vi.mocked(groqService.generateResponse).mockResolvedValueOnce('Maaf, saya sedang pusing.');

    // Act
    const result = await classifyTransactionUseCase(userId, text);

    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toContain('Maaf, saya sedang pusing');
  });
});
