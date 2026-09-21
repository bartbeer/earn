import { calculateEarnedCents, calculateMaximumCents, formatCurrency } from '@/lib/money';

// Money is always integer cents (see master spec section 6) — these tests exist
// specifically to catch any accidental drift to floating-point arithmetic.
describe('formatCurrency', () => {
  it('formats whole euros', () => {
    expect(formatCurrency(1000)).toBe('€10.00');
  });

  it('formats cents under one euro', () => {
    expect(formatCurrency(50)).toBe('€0.50');
  });

  it('formats a single cent', () => {
    expect(formatCurrency(1)).toBe('€0.01');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('€0.00');
  });

  it('pads a single-digit cent value', () => {
    expect(formatCurrency(205)).toBe('€2.05');
  });

  it('rejects negative amounts', () => {
    expect(() => formatCurrency(-1)).toThrow();
  });

  it('rejects non-integer cent values', () => {
    expect(() => formatCurrency(2.5)).toThrow();
  });
});

describe('calculateMaximumCents', () => {
  it('sums the amount of every occurrence regardless of completion', () => {
    const occurrences = [
      { amountCents: 250, status: 'completed' as const },
      { amountCents: 50, status: 'pending' as const },
      { amountCents: 100, status: 'completed' as const },
    ];

    expect(calculateMaximumCents(occurrences)).toBe(400);
  });

  it('returns 0 for an empty list', () => {
    expect(calculateMaximumCents([])).toBe(0);
  });
});

describe('calculateEarnedCents', () => {
  it('sums only completed occurrences', () => {
    const occurrences = [
      { amountCents: 250, status: 'completed' as const },
      { amountCents: 50, status: 'pending' as const },
      { amountCents: 100, status: 'completed' as const },
    ];

    expect(calculateEarnedCents(occurrences)).toBe(350);
  });

  it('returns 0 when nothing is completed', () => {
    const occurrences = [
      { amountCents: 250, status: 'pending' as const },
      { amountCents: 50, status: 'pending' as const },
    ];

    expect(calculateEarnedCents(occurrences)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(calculateEarnedCents([])).toBe(0);
  });

  it('never exceeds the maximum', () => {
    const occurrences = [
      { amountCents: 250, status: 'completed' as const },
      { amountCents: 50, status: 'completed' as const },
    ];

    expect(calculateEarnedCents(occurrences)).toBeLessThanOrEqual(
      calculateMaximumCents(occurrences),
    );
  });
});
