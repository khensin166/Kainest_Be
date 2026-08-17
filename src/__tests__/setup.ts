import { vi } from 'vitest';

// Global setup for Vitest
// Set environment variables for testing
process.env.GROQ_API_KEY = 'test_groq_api_key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Reset all mocks after each test
beforeEach(() => {
  vi.clearAllMocks();
});
