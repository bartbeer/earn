import { describeSchedule, validateSchedule } from '@/lib/schedule';

describe('validateSchedule', () => {
  describe('once_weekly', () => {
    it('is valid with exactly one day', () => {
      expect(validateSchedule('once_weekly', [6])).toEqual({ valid: true });
    });

    it('is invalid with zero days', () => {
      expect(validateSchedule('once_weekly', [])).toEqual({
        valid: false,
        reason: 'Choose one day.',
      });
    });

    it('is invalid with more than one day', () => {
      expect(validateSchedule('once_weekly', [1, 3])).toEqual({
        valid: false,
        reason: 'Choose one day.',
      });
    });
  });

  describe('selected_days', () => {
    it('is valid with one day', () => {
      expect(validateSchedule('selected_days', [1])).toEqual({ valid: true });
    });

    it('is valid with several days', () => {
      expect(validateSchedule('selected_days', [1, 3, 5])).toEqual({ valid: true });
    });

    it('is invalid with zero days', () => {
      expect(validateSchedule('selected_days', [])).toEqual({
        valid: false,
        reason: 'Choose at least one day.',
      });
    });
  });

  describe('daily', () => {
    it('is valid regardless of any days passed in (they are ignored)', () => {
      expect(validateSchedule('daily', [])).toEqual({ valid: true });
      expect(validateSchedule('daily', [0, 1, 2, 3, 4, 5, 6])).toEqual({ valid: true });
    });
  });
});

describe('describeSchedule', () => {
  it('names the single weekday for once_weekly', () => {
    expect(describeSchedule('once_weekly', [6])).toBe('Saturday');
  });

  it('joins abbreviated weekday names for selected_days', () => {
    expect(describeSchedule('selected_days', [1, 3, 5])).toBe('Mon / Wed / Fri');
  });

  it('orders selected_days by the calendar week, not input order', () => {
    expect(describeSchedule('selected_days', [5, 1, 3])).toBe('Mon / Wed / Fri');
  });

  it('describes daily chores as "Daily"', () => {
    expect(describeSchedule('daily', [])).toBe('Daily');
  });
});
