// Shared domain types mirroring the eventual database model (master spec
// section 41), so Phase 2+ can swap mock data for real Supabase rows without
// reshaping the UI layer.

export type Role = 'parent' | 'child';

/**
 * The signed-in user's family_memberships row — the single authoritative
 * source of "who am I in this app" (section 77: never trust a client-side
 * role claim). MVP assumes at most one membership per user; see
 * src/lib/authState.ts.
 */
export interface Membership {
  familyId: string;
  familyName: string;
  role: Role;
  /** Set only when role === 'child'. */
  childId: string | null;
}

export type OccurrenceStatus = 'pending' | 'completed';

export interface Child {
  id: string;
  name: string;
}

export type RecurrenceType = 'once_weekly' | 'selected_days' | 'daily';

/** A chore definition (master spec section 28). Editing this never rewrites already-created occurrences — see ChoreOccurrence. */
export interface Chore {
  id: string;
  familyId: string;
  childId: string;
  name: string;
  amountCents: number;
  recurrenceType: RecurrenceType;
  active: boolean;
  /** 0 = Sunday .. 6 = Saturday. Empty for 'daily' (every day is implicit). */
  scheduleDays: number[];
}

/** One earnable instance of a chore on one date — the row a checkbox controls. */
export interface ChoreOccurrence {
  id: string;
  choreId: string;
  childId: string;
  /** Snapshot of the chore's name at scheduling time — survives chore renames (section 42). */
  name: string;
  /** Snapshot of the chore's amount at scheduling time — survives chore price changes (section 42). */
  amountCents: number;
  scheduledDate: string; // ISO date (YYYY-MM-DD), interpreted in the family's timezone
  status: OccurrenceStatus;
}

export type PaymentStatus = 'not_paid' | 'paid';

export interface WeekSummary {
  id: string;
  childId: string;
  weekStart: string; // ISO date, Monday
  weekEnd: string; // ISO date, Sunday
  maximumCents: number;
  earnedCents: number;
  paymentStatus: PaymentStatus;
  paidAmountCents: number | null;
  occurrences: ChoreOccurrence[];
}
