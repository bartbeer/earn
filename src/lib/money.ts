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
