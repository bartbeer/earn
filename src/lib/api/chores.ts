// Real Supabase reads/writes for chore management (Phase 4). Like
// src/lib/api/family.ts, nothing here trusts a client-supplied role — RLS
// (parents only, own family only; see the Phase 2/4 migrations) is the
// actual authorization boundary.
import { supabase } from '@/lib/supabase';
import type { Chore, RecurrenceType } from '@/types/domain';

interface ChoreRow {
  id: string;
  family_id: string;
  child_id: string;
  name: string;
  amount_cents: number;
  recurrence_type: RecurrenceType;
  active: boolean;
  chore_schedule: { day_of_week: number }[];
}

function mapChore(row: ChoreRow): Chore {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    name: row.name,
    amountCents: row.amount_cents,
    recurrenceType: row.recurrence_type,
    active: row.active,
    scheduleDays: row.chore_schedule.map((s) => s.day_of_week).sort((a, b) => a - b),
  };
}

const CHORE_COLUMNS =
  'id, family_id, child_id, name, amount_cents, recurrence_type, active, chore_schedule(day_of_week)';

/** Every active chore in a family, across all children. */
export async function fetchChores(familyId: string): Promise<Chore[]> {
  const { data, error } = await supabase
    .from('chores')
    .select(CHORE_COLUMNS)
    .eq('family_id', familyId)
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row) => mapChore(row as ChoreRow));
}

export async function fetchChoreById(choreId: string): Promise<Chore | null> {
  const { data, error } = await supabase
    .from('chores')
    .select(CHORE_COLUMNS)
    .eq('id', choreId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapChore(data as ChoreRow) : null;
}

export interface ChoreInput {
  familyId: string;
  childId: string;
  name: string;
  amountCents: number;
  recurrenceType: RecurrenceType;
  /** 0 = Sunday .. 6 = Saturday. Ignored for 'daily'. */
  scheduleDays: number[];
}

async function replaceSchedule(
  choreId: string,
  scheduleDays: number[],
  recurrenceType: RecurrenceType,
) {
  const { error: deleteError } = await supabase
    .from('chore_schedule')
    .delete()
    .eq('chore_id', choreId);
  if (deleteError) throw deleteError;

  if (recurrenceType === 'daily' || scheduleDays.length === 0) return;

  const { error: insertError } = await supabase
    .from('chore_schedule')
    .insert(scheduleDays.map((day) => ({ chore_id: choreId, day_of_week: day })));
  if (insertError) throw insertError;
}

export async function createChore(input: ChoreInput): Promise<Chore> {
  const { data: chore, error } = await supabase
    .from('chores')
    .insert({
      family_id: input.familyId,
      child_id: input.childId,
      name: input.name,
      amount_cents: input.amountCents,
      recurrence_type: input.recurrenceType,
    })
    .select('id, family_id, child_id, name, amount_cents, recurrence_type, active')
    .single();
  if (error) throw error;

  await replaceSchedule(chore.id, input.scheduleDays, input.recurrenceType);

  return {
    ...mapChoreBase(chore),
    scheduleDays: input.recurrenceType === 'daily' ? [] : input.scheduleDays,
  };
}

function mapChoreBase(row: Omit<ChoreRow, 'chore_schedule'>): Omit<Chore, 'scheduleDays'> {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    name: row.name,
    amountCents: row.amount_cents,
    recurrenceType: row.recurrence_type,
    active: row.active,
  };
}

export async function updateChore(
  choreId: string,
  input: Omit<ChoreInput, 'familyId' | 'childId'>,
): Promise<Chore> {
  const { data: chore, error } = await supabase
    .from('chores')
    .update({
      name: input.name,
      amount_cents: input.amountCents,
      recurrence_type: input.recurrenceType,
    })
    .eq('id', choreId)
    .select('id, family_id, child_id, name, amount_cents, recurrence_type, active')
    .single();
  if (error) throw error;

  await replaceSchedule(choreId, input.scheduleDays, input.recurrenceType);

  return {
    ...mapChoreBase(chore),
    scheduleDays: input.recurrenceType === 'daily' ? [] : input.scheduleDays,
  };
}

/** Deactivates a chore. Never deletes — historical occurrences must keep referring to a real row (section 43). */
export async function deactivateChore(choreId: string): Promise<void> {
  const { error } = await supabase.from('chores').update({ active: false }).eq('id', choreId);
  if (error) throw error;
}
