import type { RecurrenceType } from '@/types/domain';

// 0 = Sunday .. 6 = Saturday — matches JS Date#getDay(), the convention the
// whole app (and the chore_schedule.day_of_week column) uses throughout.
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const WEEKDAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type ScheduleValidation = { valid: true } | { valid: false; reason: string };

/**
 * Whether a set of chosen weekdays makes sense for a given recurrence type.
 * Pure and synchronous so it can run instantly in a form, before ever
 * hitting the network — the chore_schedule table itself doesn't enforce
 * "exactly one day for once_weekly" (see the Phase 2 migration comment on
 * why it's shaped as a flexible tag table), so this is the actual rule.
 */
export function validateSchedule(
  recurrenceType: RecurrenceType,
  days: number[],
): ScheduleValidation {
  switch (recurrenceType) {
    case 'once_weekly':
      if (days.length !== 1) return { valid: false, reason: 'Choose one day.' };
      return { valid: true };
    case 'selected_days':
      if (days.length === 0) return { valid: false, reason: 'Choose at least one day.' };
      return { valid: true };
    case 'daily':
      return { valid: true };
  }
}

/** A short, child-friendly description of a chore's schedule (section 18: never expose raw recurrence config). */
export function describeSchedule(recurrenceType: RecurrenceType, days: number[]): string {
  switch (recurrenceType) {
    case 'once_weekly':
      return days[0] !== undefined ? WEEKDAY_NAMES[days[0]] : '';
    case 'selected_days':
      return [...days]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_ABBREVIATIONS[day])
        .join(' / ');
    case 'daily':
      return 'Daily';
  }
}
