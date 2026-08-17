import { describe, it, expect } from 'vitest';
import { getCycleBoundaries } from '../cycleBoundaries.js';

// Helper to format Date to yyyy-MM-dd
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('cycleBoundaries', () => {
  describe('getCycleBoundaries', () => {
    it('should correctly calculate boundaries when current date is past the cycle start date', () => {
      // Arrange
      // Current date: Aug 20, 2026. Cycle start: 15
      const currentDate = new Date(2026, 7, 20); // Month is 0-indexed (7 = Aug)
      const cycleStartDay = 15;

      // Act
      const boundaries = getCycleBoundaries(currentDate, cycleStartDay);

      // Assert
      expect(formatDate(boundaries.cycleStart)).toBe('2026-08-15');
      // Next cycle starts on Sept 15, so end is Sept 14
      expect(formatDate(boundaries.cycleEnd)).toBe('2026-09-14');
    });

    it('should correctly calculate boundaries when current date is before the cycle start date', () => {
      // Arrange
      // Current date: Aug 10, 2026. Cycle start: 15
      const currentDate = new Date(2026, 7, 10);
      const cycleStartDay = 15;

      // Act
      const boundaries = getCycleBoundaries(currentDate, cycleStartDay);

      // Assert
      // Because we haven't reached the 15th yet, the cycle started last month (July 15)
      expect(formatDate(boundaries.cycleStart)).toBe('2026-07-15');
      // And ends the day before this month's 15th
      expect(formatDate(boundaries.cycleEnd)).toBe('2026-08-14');
    });

    it('should handle cycle start dates that exceed the days in a month (e.g. 31)', () => {
      // Arrange
      // Current date: Feb 20, 2026. Cycle start: 31
      const currentDate = new Date(2026, 1, 20); // Feb 20
      const cycleStartDay = 31;

      // Act
      const boundaries = getCycleBoundaries(currentDate, cycleStartDay);

      // Assert
      // Jan has 31 days, so cycle started Jan 31
      expect(formatDate(boundaries.cycleStart)).toBe('2026-01-31');
      
      // Feb only has 28 days in 2026. The end of the cycle should be Feb 27 (day before Feb 28)
      expect(formatDate(boundaries.cycleEnd)).toBe('2026-02-27');
    });
  });
});

