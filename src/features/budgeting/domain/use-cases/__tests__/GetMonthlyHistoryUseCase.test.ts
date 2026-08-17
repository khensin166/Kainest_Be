import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMonthlyHistoryUseCase } from '../GetMonthlyHistoryUseCase.js';
import { budgetRepository } from '../../../data/BudgetRepository.js';

vi.mock('../../../data/BudgetRepository.js', () => ({
  budgetRepository: {
    findAllMonthlyHistory: vi.fn(),
  },
}));

describe('GetMonthlyHistoryUseCase', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate gross totalIncome correctly by summing salary and additional income', async () => {
    // Arrange
    const mockDate = new Date();
    vi.mocked(budgetRepository.findAllMonthlyHistory).mockResolvedValue([
      {
        id: 'hist-1',
        period: mockDate,
        salarySnapshot: 5000000,
        totalIncome: 500000, // additional income
        totalBudgeted: 3000000,
        totalSpent: 2000000,
        totalSaved: 500000,
        pocketsSnapshot: {},
        userId: userId,
        createdAt: mockDate,
        updatedAt: mockDate
      }
    ] as any);

    // Act
    const result = await getMonthlyHistoryUseCase(userId);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    
    const data = result.data![0];
    expect(data.totalIncome).toBe(5500000); // 5000000 + 500000
    expect(data.additionalIncome).toBe(500000);
    expect(data.totalSpent).toBe(2000000);
  });

  it('should handle zero history gracefully', async () => {
    // Arrange
    vi.mocked(budgetRepository.findAllMonthlyHistory).mockResolvedValue([]);

    // Act
    const result = await getMonthlyHistoryUseCase(userId);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});

