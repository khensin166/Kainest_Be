import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateMonthlyBudgetUseCase } from '../EvaluateMonthlyBudgetUseCase.js';
import { budgetRepository } from '../../../data/BudgetRepository.js';
import { groqService } from '../../../../../infrastructure/ai/groqService.js';
import { prisma } from '../../../../../infrastructure/database/prisma.js';

vi.mock('../../../data/BudgetRepository.js', () => ({
  budgetRepository: {
    findMonthlyHistory: vi.fn(),
    getMonthlyExpenseGrouped: vi.fn(),
  },
}));

vi.mock('../../../../../infrastructure/ai/groqService.js', () => ({
  groqService: {
    generateResponse: vi.fn(),
  },
}));

vi.mock('../../../../../infrastructure/database/prisma.js', () => ({
  prisma: {
    aISuggestion: {
      create: vi.fn(),
    },
  },
}));

describe('EvaluateMonthlyBudgetUseCase', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should evaluate budget successfully and update history', async () => {
    // Arrange
    const historyId = 'hist-1';
    vi.mocked(budgetRepository.findMonthlyHistory).mockResolvedValue({
      id: historyId,
      pocketsSnapshot: [
        { categoryId: 'cat-1', categoryName: 'Makan', limitAmount: 2000000 }
      ]
    } as any);

    vi.mocked(budgetRepository.getMonthlyExpenseGrouped).mockResolvedValue([
      { categoryId: 'cat-1', _sum: { amount: 1500000 } }
    ] as any);

    // Mock AI response
    const mockAiResponse = JSON.stringify({
      overall_status: "Bagus",
      summary: "Pengeluaran cukup terkendali",
      key_insights: ["Anda hemat 25%"],
      recommendations: ["Tabung sisa uang"]
    });
    vi.mocked(groqService.generateResponse).mockResolvedValue(mockAiResponse);

    // Act
    const result = await evaluateMonthlyBudgetUseCase(userId);

    // Assert
    expect(result.success).toBe(true);
    expect(groqService.generateResponse).toHaveBeenCalled();
    expect(prisma.aISuggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'MONTHLY_EVAL',
        userId: userId,
      })
    });
    
    // Verify parsed data
    const evalData = JSON.parse((prisma.aISuggestion.create as any).mock.calls[0][0].data.suggestion_text);
    expect(evalData.ai_message).toContain('Bagus');
  });

  it('should handle AI service failures gracefully', async () => {
    // Arrange
    vi.mocked(budgetRepository.findMonthlyHistory).mockResolvedValue({
      id: 'hist-1',
      pocketsSnapshot: []
    } as any);

    vi.mocked(budgetRepository.getMonthlyExpenseGrouped).mockResolvedValue([]);

    // Mock AI throwing an error
    vi.mocked(groqService.generateResponse).mockRejectedValue(new Error('AI Service Down'));

    // Act
    const result = await evaluateMonthlyBudgetUseCase(userId);

    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toContain('Evaluation failed'); 
    expect(prisma.aISuggestion.create).not.toHaveBeenCalled();
  });
});
