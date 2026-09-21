import { isOccurrenceToday, toISODate } from '@/lib/date';

describe('toISODate', () => {
  it('formats using local calendar date, not a UTC-shifted one', () => {
    // Local midnight — a naive `toISOString().slice(0, 10)` implementation
    // shifts this back a day in any timezone ahead of UTC.
    const localMidnight = new Date(2026, 8, 21, 0, 0, 0);
    expect(toISODate(localMidnight)).toBe('2026-09-21');
  });

  it('pads single-digit month and day', () => {
    const date = new Date(2026, 0, 5, 0, 0, 0);
    expect(toISODate(date)).toBe('2026-01-05');
  });
});

describe('isOccurrenceToday', () => {
  it('is true when the scheduled date matches today', () => {
    expect(isOccurrenceToday('2026-09-21', '2026-09-21')).toBe(true);
  });

  it('is false when the scheduled date is before today', () => {
    expect(isOccurrenceToday('2026-09-20', '2026-09-21')).toBe(false);
  });

  it('is false when the scheduled date is after today', () => {
    expect(isOccurrenceToday('2026-09-22', '2026-09-21')).toBe(false);
  });
});
