// Money is always stored and calculated as integer cents (master spec section 6).
// formatCurrency() is the ONLY place cents should ever be converted to a euro
// string for display — never format or do float math on money elsewhere.
//
// Extra feature: a child can earn stars instead of euros (some parents don't
// want a younger child working for real money). Stars reuse the exact same
// integer amount_cents columns — for a stars child, the raw integer is just
// a whole star count rather than euro cents. formatReward()/parseRewardAmount()/
// isValidRewardAmount() are the reward-type-aware entry points; formatCurrency()
// and formatStars() are their unit-specific halves.
import type { RewardType } from '@/types/domain';

/** A subset of a chore occurrence sufficient to sum money: its snapshot amount and status. */
export interface MoneyOccurrence {
  amountCents: number;
  status: 'pending' | 'completed';
}

function assertNonNegativeInteger(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new Error(`Amount must be an integer, got ${amount}`);
  }
  if (amount < 0) {
    throw new Error(`Amount must not be negative, got ${amount}`);
  }
}

/** Formats an integer cent amount as a euro string, e.g. 250 -> "€2.50". */
export function formatCurrency(cents: number): string {
  assertNonNegativeInteger(cents);
  const euros = Math.floor(cents / 100);
  const remainderCents = cents % 100;
  return `€${euros}.${remainderCents.toString().padStart(2, '0')}`;
}

/** The maximum this week is worth: every scheduled occurrence, completed or not. */
export function calculateMaximumCents(occurrences: readonly MoneyOccurrence[]): number {
  return occurrences.reduce((total, occurrence) => {
    assertNonNegativeInteger(occurrence.amountCents);
    return total + occurrence.amountCents;
  }, 0);
}

/** What has actually been earned so far: only completed occurrences count. */
export function calculateEarnedCents(occurrences: readonly MoneyOccurrence[]): number {
  return occurrences.reduce((total, occurrence) => {
    assertNonNegativeInteger(occurrence.amountCents);
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

/** Formats a whole star count for display, e.g. 3 -> "3 ⭐". No decimals — stars aren't a fractional unit. */
export function formatStars(amount: number): string {
  assertNonNegativeInteger(amount);
  return `${amount} ⭐`;
}

/** formatCurrency or formatStars, chosen by the child's reward type. */
export function formatReward(amount: number, rewardType: RewardType): string {
  return rewardType === 'stars' ? formatStars(amount) : formatCurrency(amount);
}

// Sanity cap for a single chore's star amount (section 63's reasoning,
// applied to stars: reject an obvious typo outright rather than just
// discouraging it in the UI). Deliberately smaller than the euro cap since
// stars have no fractional sub-unit to make a large number less extreme.
export const MAX_STARS_AMOUNT = 1_000;

const WHOLE_NUMBER_PATTERN = /^(\d+)$/;

/**
 * Parses a parent's stars-amount form input (e.g. "3") into a whole star
 * count, or null if it isn't a non-negative whole number. No decimals
 * accepted at all — unlike parseEuroAmountToCents, there's no sub-unit to
 * round into.
 */
export function parseWholeStarsAmount(input: string): number | null {
  const match = WHOLE_NUMBER_PATTERN.exec(input.trim());
  if (!match) return null;
  return parseInt(match[1], 10);
}

/** Whether a whole star amount is acceptable for a chore. */
export function isValidStarsAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0 && amount <= MAX_STARS_AMOUNT;
}

/** isValidChoreAmountCents or isValidStarsAmount, chosen by the child's reward type. */
export function isValidRewardAmount(amount: number, rewardType: RewardType): boolean {
  return rewardType === 'stars' ? isValidStarsAmount(amount) : isValidChoreAmountCents(amount);
}

/** parseEuroAmountToCents or parseWholeStarsAmount, chosen by the child's reward type. */
export function parseRewardAmount(input: string, rewardType: RewardType): number | null {
  return rewardType === 'stars' ? parseWholeStarsAmount(input) : parseEuroAmountToCents(input);
}
