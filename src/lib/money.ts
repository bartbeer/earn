// Money is always stored and calculated as integer cents (master spec section 6).
// formatCurrency() is the ONLY place cents should ever be converted to a euro
// string for display — never format or do float math on money elsewhere.

/** A subset of a chore occurrence sufficient to sum money: its snapshot amount and status. */
export interface MoneyOccurrence {
  amountCents: number;
  status: 'pending' | 'completed';
}

function assertValidCents(cents: number): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`Amount must be an integer number of cents, got ${cents}`);
  }
  if (cents < 0) {
    throw new Error(`Amount must not be negative, got ${cents}`);
  }
}

/** Formats an integer cent amount as a euro string, e.g. 250 -> "€2.50". */
export function formatCurrency(cents: number): string {
  assertValidCents(cents);
  const euros = Math.floor(cents / 100);
  const remainderCents = cents % 100;
  return `€${euros}.${remainderCents.toString().padStart(2, '0')}`;
}

/** The maximum this week is worth: every scheduled occurrence, completed or not. */
export function calculateMaximumCents(occurrences: readonly MoneyOccurrence[]): number {
  return occurrences.reduce((total, occurrence) => {
    assertValidCents(occurrence.amountCents);
    return total + occurrence.amountCents;
  }, 0);
}

/** What has actually been earned so far: only completed occurrences count. */
export function calculateEarnedCents(occurrences: readonly MoneyOccurrence[]): number {
  return occurrences.reduce((total, occurrence) => {
    assertValidCents(occurrence.amountCents);
    return occurrence.status === 'completed' ? total + occurrence.amountCents : total;
  }, 0);
}

// Sanity cap matching the chores.amount_cents check constraint (section 63:
// an unreasonable amount, e.g. a typo with extra zeros, should be rejected
// outright). €1,000 per single completion is already far beyond any
// realistic chore value.
export const MAX_CHORE_AMOUNT_CENTS = 100_000;

const EURO_AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a parent's euro-amount form input (e.g. "2.50") into integer
 * cents, or null if the input isn't a valid non-negative amount with at
 * most two decimal places. Deliberately string-based, never
 * `parseFloat(input) * 100` — float arithmetic on money is exactly what
 * section 6 exists to rule out, and that includes parsing user input, not
 * just storage.
 */
export function parseEuroAmountToCents(input: string): number | null {
  const match = EURO_AMOUNT_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, wholePart, fractionalPart = ''] = match;
  const paddedFraction = fractionalPart.padEnd(2, '0');
  return parseInt(wholePart, 10) * 100 + parseInt(paddedFraction, 10);
}

/** Whether an integer cent amount is acceptable for a chore (matches the DB check constraint). */
export function isValidChoreAmountCents(cents: number): boolean {
  return Number.isInteger(cents) && cents >= 0 && cents <= MAX_CHORE_AMOUNT_CENTS;
}
