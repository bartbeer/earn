import {
  calculateEarnedCents,
  calculateMaximumCents,
  formatCurrency,
  isValidChoreAmountCents,
  parseEuroAmountToCents,
} from '@/lib/money';

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

// A parent typing a chore amount into a form is the reverse of
// formatCurrency() — equally important to get exactly right, since a float
// slip here (e.g. parseFloat("2.50") * 100) can land on 249 or 250
// depending on the runtime. Implemented via string manipulation only, never
// float arithmetic, for the same reason section 6 bans floats for storage.
describe('parseEuroAmountToCents', () => {
  it('parses a whole euro amount', () => {
    expect(parseEuroAmountToCents('10')).toBe(1000);
  });

  it('parses a two-decimal amount', () => {
    expect(parseEuroAmountToCents('2.50')).toBe(250);
  });

  it('parses a one-decimal amount as the first decimal place', () => {
    expect(parseEuroAmountToCents('2.5')).toBe(250);
  });

  it('parses a single cent', () => {
    expect(parseEuroAmountToCents('0.01')).toBe(1);
  });

  it('parses zero', () => {
    expect(parseEuroAmountToCents('0')).toBe(0);
  });

  it('trims surrounding whitespace', () => {
    expect(parseEuroAmountToCents('  3.00  ')).toBe(300);
  });

  it('returns null for empty input', () => {
    expect(parseEuroAmountToCents('')).toBeNull();
  });

  it('returns null for a negative amount', () => {
    expect(parseEuroAmountToCents('-1')).toBeNull();
  });

  it('returns null for more than two decimal places', () => {
    expect(parseEuroAmountToCents('2.505')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(parseEuroAmountToCents('abc')).toBeNull();
  });

  it('returns null for a comma decimal separator (not supported in MVP)', () => {
    expect(parseEuroAmountToCents('2,50')).toBeNull();
  });
});

describe('isValidChoreAmountCents', () => {
  it('accepts zero', () => {
    expect(isValidChoreAmountCents(0)).toBe(true);
  });

  it('accepts one cent', () => {
    expect(isValidChoreAmountCents(1)).toBe(true);
  });

  it('accepts the maximum allowed amount', () => {
    expect(isValidChoreAmountCents(100_000)).toBe(true);
  });

  it('rejects an amount over the sanity cap', () => {
    expect(isValidChoreAmountCents(100_001)).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(isValidChoreAmountCents(-1)).toBe(false);
  });

  it('rejects a non-integer amount', () => {
    expect(isValidChoreAmountCents(2.5)).toBe(false);
  });
});
