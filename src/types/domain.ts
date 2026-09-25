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

/**
 * Whether a child's amount_cents columns mean euro cents or whole stars —
 * some parents don't want a younger child working for real money at all.
 * Set per child, not per family, since siblings might use different units.
 * Locked server-side once the child has any chore (see the reward-type
 * migration) — history in one unit is never silently reinterpreted as the
 * other.
 */
export type RewardType = 'currency' | 'stars';

export interface Child {
  id: string;
  name: string;
  rewardType: RewardType;
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
  /** The owning child's reward type, carried alongside the week itself so a standalone deep-linked screen (e.g. history/[weekId]) never needs a separate children-list fetch just to know which unit to display. */
  childRewardType: RewardType;
  weekStart: string; // ISO date, Monday
  weekEnd: string; // ISO date, Sunday
  maximumCents: number;
  earnedCents: number;
  paymentStatus: PaymentStatus;
  paidAmountCents: number | null;
  occurrences: ChoreOccurrence[];
}
