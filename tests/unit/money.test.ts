import {
  calculateEarnedCents,
  calculateMaximumCents,
  formatCurrency,
  formatReward,
  formatStars,
  isValidChoreAmountCents,
  isValidRewardAmount,
  parseEuroAmountToCents,
  parseRewardAmount,
  parseWholeStarsAmount,
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

// Extra feature: a child can earn stars instead of euros. Stars are always
// whole numbers — no cents-style scaling, unlike currency.
describe('formatStars', () => {
  it('formats a whole number of stars', () => {
    expect(formatStars(3)).toBe('3 ⭐');
  });

  it('formats zero stars', () => {
    expect(formatStars(0)).toBe('0 ⭐');
  });

  it('rejects a negative amount', () => {
    expect(() => formatStars(-1)).toThrow();
  });

  it('rejects a non-integer amount', () => {
    expect(() => formatStars(2.5)).toThrow();
  });
});

describe('formatReward', () => {
  it('formats a currency amount as euros', () => {
    expect(formatReward(250, 'currency')).toBe('€2.50');
  });

  it('formats a stars amount as stars', () => {
    expect(formatReward(3, 'stars')).toBe('3 ⭐');
  });
});

describe('parseWholeStarsAmount', () => {
  it('parses a whole number', () => {
    expect(parseWholeStarsAmount('3')).toBe(3);
  });

  it('parses zero', () => {
    expect(parseWholeStarsAmount('0')).toBe(0);
  });

  it('trims surrounding whitespace', () => {
    expect(parseWholeStarsAmount('  5  ')).toBe(5);
  });

  it('returns null for a decimal amount — stars are whole numbers only', () => {
    expect(parseWholeStarsAmount('2.5')).toBeNull();
  });

  it('returns null for a negative amount', () => {
    expect(parseWholeStarsAmount('-1')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseWholeStarsAmount('')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(parseWholeStarsAmount('abc')).toBeNull();
  });
});

describe('isValidRewardAmount', () => {
  it('accepts a valid currency amount', () => {
    expect(isValidRewardAmount(250, 'currency')).toBe(true);
  });

  it('rejects a currency amount over the sanity cap', () => {
    expect(isValidRewardAmount(100_001, 'currency')).toBe(false);
  });

  it('accepts a valid stars amount', () => {
    expect(isValidRewardAmount(3, 'stars')).toBe(true);
  });

  it('rejects a stars amount over the sanity cap', () => {
    expect(isValidRewardAmount(1001, 'stars')).toBe(false);
  });

  it('rejects a negative stars amount', () => {
    expect(isValidRewardAmount(-1, 'stars')).toBe(false);
  });
});

describe('parseRewardAmount', () => {
  it('parses a currency amount with decimals', () => {
    expect(parseRewardAmount('2.50', 'currency')).toBe(250);
  });

  it('parses a stars amount as a whole number', () => {
    expect(parseRewardAmount('3', 'stars')).toBe(3);
  });

  it('rejects a decimal stars amount', () => {
    expect(parseRewardAmount('2.5', 'stars')).toBeNull();
  });
});
