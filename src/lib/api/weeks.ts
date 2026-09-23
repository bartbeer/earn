// Real Supabase reads/writes for a child's weeks. Completion now goes
// through the set_occurrence_completion RPC (Phase 6) — payment status
// still has no client write path (see the comments on weekly_allowances in
// the Phase 2 migrations) until Phase 8 adds that RPC.
import { toISODate } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type { ChoreOccurrence, WeekSummary } from '@/types/domain';

interface WeeklyAllowanceRow {
  id: string;
  child_id: string;
  week_start: string;
  week_end: string;
  maximum_cents: number;
  earned_cents: number;
  payment_status: 'not_paid' | 'paid';
  paid_amount_cents: number | null;
}

interface OccurrenceRow {
  id: string;
  chore_id: string;
  child_id: string;
  scheduled_date: string;
  chore_name_snapshot: string;
  amount_cents_snapshot: number;
  status: 'pending' | 'completed';
}

function mapOccurrence(row: OccurrenceRow): ChoreOccurrence {
  return {
    id: row.id,
    choreId: row.chore_id,
    childId: row.child_id,
    name: row.chore_name_snapshot,
    amountCents: row.amount_cents_snapshot,
    scheduledDate: row.scheduled_date,
    status: row.status,
  };
}

async function fetchOccurrencesForWeek(
  childId: string,
  weekStart: string,
  weekEnd: string,
): Promise<ChoreOccurrence[]> {
  const { data, error } = await supabase
    .from('chore_occurrences')
    .select(
      'id, chore_id, child_id, scheduled_date, chore_name_snapshot, amount_cents_snapshot, status',
    )
    .eq('child_id', childId)
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd)
    .order('scheduled_date');
  if (error) throw error;
  return (data ?? []).map(mapOccurrence);
}

function mapWeekRow(row: WeeklyAllowanceRow, occurrences: ChoreOccurrence[]): WeekSummary {
  return {
    id: row.id,
    childId: row.child_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    maximumCents: row.maximum_cents,
    earnedCents: row.earned_cents,
    paymentStatus: row.payment_status,
    paidAmountCents: row.paid_amount_cents,
    occurrences,
  };
}

const WEEKLY_ALLOWANCE_COLUMNS =
  'id, child_id, week_start, week_end, maximum_cents, earned_cents, payment_status, paid_amount_cents';

/**
 * Ensures this week's occurrences exist for a family before reading them —
 * the on-demand trigger for Phase 5's recurrence generation (see the RPC's
 * own comments in the migration for why there's no cron job: calling this
 * idempotent function is safe and cheap enough to just do on every read,
 * which also means opening the app after any gap self-heals rather than
 * needing a scheduler).
 */
export async function generateCurrentWeekOccurrences(familyId: string): Promise<void> {
  const { error } = await supabase.rpc('generate_current_week_occurrences', {
    p_family_id: familyId,
  });
  if (error) throw error;
}

/** The week containing today, or null if none has been generated yet for this child. */
export async function fetchCurrentWeek(
  childId: string,
  familyId: string,
): Promise<WeekSummary | null> {
  await generateCurrentWeekOccurrences(familyId);

  const today = toISODate(new Date());
  const { data, error } = await supabase
    .from('weekly_allowances')
    .select(WEEKLY_ALLOWANCE_COLUMNS)
    .eq('child_id', childId)
    .lte('week_start', today)
    .gte('week_end', today)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const occurrences = await fetchOccurrencesForWeek(childId, data.week_start, data.week_end);
  return mapWeekRow(data, occurrences);
}

/** Every week that has fully ended, most recent first. */
export async function fetchWeekHistory(childId: string): Promise<WeekSummary[]> {
  const today = toISODate(new Date());
  const { data, error } = await supabase
    .from('weekly_allowances')
    .select(WEEKLY_ALLOWANCE_COLUMNS)
    .eq('child_id', childId)
    .lt('week_end', today)
    .order('week_start', { ascending: false });
  if (error) throw error;

  const weeks = data ?? [];
  return Promise.all(
    weeks.map(async (week) => {
      const occurrences = await fetchOccurrencesForWeek(
        week.child_id,
        week.week_start,
        week.week_end,
      );
      return mapWeekRow(week, occurrences);
    }),
  );
}

/**
 * Marks an occurrence completed or not. Returns the authoritative updated
 * row — the caller should reconcile local optimistic state with this
 * rather than assuming its own guess was exactly right (section 50: the
 * database is the source of truth).
 */
export async function setOccurrenceCompletion(
  occurrenceId: string,
  completed: boolean,
): Promise<ChoreOccurrence> {
  const { data, error } = await supabase.rpc('set_occurrence_completion', {
    p_occurrence_id: occurrenceId,
    p_completed: completed,
  });
  if (error) throw error;
  return mapOccurrence(data as OccurrenceRow);
}

export async function fetchWeekById(weeklyAllowanceId: string): Promise<WeekSummary | null> {
  const { data, error } = await supabase
    .from('weekly_allowances')
    .select(WEEKLY_ALLOWANCE_COLUMNS)
    .eq('id', weeklyAllowanceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const occurrences = await fetchOccurrencesForWeek(data.child_id, data.week_start, data.week_end);
  return mapWeekRow(data, occurrences);
}
