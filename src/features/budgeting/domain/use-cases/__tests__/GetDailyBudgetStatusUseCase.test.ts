import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDailyBudgetStatusUseCase } from '../GetDailyBudgetStatusUseCase.js';
import { budgetRepository } from '../../../data/BudgetRepository.js';
import { transactionRepository } from '../../../data/TransactionRepository.js';

vi.mock('../../../data/BudgetRepository.js', () => ({
  budgetRepository: {
    findMonthlyHistory: vi.fn(),
  },
}));

vi.mock('../../../data/TransactionRepository.js', () => ({
  transactionRepository: {
    sumExpenseByCategory: vi.fn(),
  },
}));

describe('GetDailyBudgetStatusUseCase', () => {
  const userId = 'user-123';
  const categoryId = 'cat-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate GREEN zone correctly when spending is well below limit', async () => {
    // Arrange
    vi.mocked(budgetRepository.findMonthlyHistory).mockResolvedValue({
      pocketsSnapshot: [
        { categoryId: 'cat-123', categoryName: 'Makan', limitAmount: 3000000 }
      ]
    } as any);
    
    // Spend 1,000,000 out of 3,000,000
    vi.mocked(transactionRepository.sumExpenseByCategory).mockResolvedValue(1000000);

    // Act
    const result = await getDailyBudgetStatusUseCase(userId, categoryId);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.limit_month).toBe(3000000);
    expect(result.data!.spent_so_far).toBe(1000000);
    expect(result.data!.remaining).toBe(2000000);
    expect(result.data!.zone).toBe('GREEN');
  });

  it('should return OVERSPENT zone when remaining is 0 or less', async () => {
    // Arrange
    vi.mocked(budgetRepository.findMonthlyHistory).mockResolvedValue({
      pocketsSnapshot: [
        { categoryId: 'cat-123', categoryName: 'Makan', limitAmount: 1000000 }
      ]
    } as any);
    
    vi.mocked(transactionRepository.sumExpenseByCategory).mockResolvedValue(1200000);

    // Act
    const result = await getDailyBudgetStatusUseCase(userId, categoryId);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data!.zone).toBe('OVERSPENT');
    expect(result.data!.remaining).toBe(-200000);
  });

  it('should return null data when budget is not set', async () => {
    // Arrange
    vi.mocked(budgetRepository.findMonthlyHistory).mockResolvedValue({
      pocketsSnapshot: [] // Category not found
    } as any);

    // Act
    const result = await getDailyBudgetStatusUseCase(userId, categoryId);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(result.message).toBe("No budget set for this category");
  });
});
