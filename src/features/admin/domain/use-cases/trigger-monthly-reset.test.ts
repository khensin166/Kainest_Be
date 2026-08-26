import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { TriggerMonthlyResetUseCase } from './trigger-monthly-reset.use-case.js';
import { AdminRepository } from '../../data/admin.repository.js';
import * as monthlyResetCron from '../../../budgeting/services/MonthlyResetCron.js';

// Mock dependensi
vi.mock('../../data/admin.repository.js');
vi.mock('../../../budgeting/services/MonthlyResetCron.js', () => ({
  processUserReset: vi.fn()
}));

describe('TriggerMonthlyResetUseCase', () => {
  let useCase: TriggerMonthlyResetUseCase;
  let mockAdminRepo: Mocked<AdminRepository>;

  beforeEach(() => {
    mockAdminRepo = new AdminRepository() as Mocked<AdminRepository>;
    useCase = new TriggerMonthlyResetUseCase(mockAdminRepo);
    vi.clearAllMocks();
  });

  it('should return error if targetUserId is missing', async () => {
    const result = await useCase.execute('');
    expect(result.success).toBe(false);
    expect(result.message).toBe('targetUserId is required.');
    expect(mockAdminRepo.getUserForReset).not.toHaveBeenCalled();
  });

  it('should return error if user is not found', async () => {
    mockAdminRepo.getUserForReset.mockResolvedValue(null as any);
    const result = await useCase.execute('invalid-id');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Target user not found.');
    expect(monthlyResetCron.processUserReset).not.toHaveBeenCalled();
  });

  it('should call processUserReset and return success if user exists', async () => {
    const mockUser = {
      id: 'valid-id',
      name: 'Kenan',
      payday: 31,
      waBotConfig: { baseUrl: 'url' },
      botActiveGroups: []
    };
    mockAdminRepo.getUserForReset.mockResolvedValue(mockUser as any);

    const result = await useCase.execute('valid-id');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Kenan');
    expect(monthlyResetCron.processUserReset).toHaveBeenCalledWith(mockUser);
  });
});
