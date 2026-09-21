import type { Child, ChoreOccurrence, WeekSummary } from '@/types/domain';
import { toISODate } from '@/lib/date';
import { calculateEarnedCents, calculateMaximumCents } from '@/lib/money';

// Temporary in-memory data for Phase 1 (design system / static UI). This file
// is replaced entirely once real Supabase data lands in Phase 2-3 — nothing
// here is meant to become production business logic beyond the shared date/money
// helpers, so most of this stays local rather than becoming the real
// getWeekBoundary()/generateRecurrenceDates() functions Phase 5-7 will build test-first.

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Monday of the week containing `date` (JS getDay(): Sun=0 .. Sat=6). */
function mondayOfWeek(date: Date): Date {
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(date, diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

interface ChoreTemplate {
  choreId: string;
  name: string;
  amountCents: number;
  /** Days this chore occurs on, using JS getDay() convention (Sun=0..Sat=6). */
  days: number[];
}

const EMMA_CHORES: ChoreTemplate[] = [
  { choreId: 'chore-emma-room-tidy', name: 'Room tidy', amountCents: 250, days: [6] },
  { choreId: 'chore-emma-dishwasher', name: 'Dishwasher', amountCents: 50, days: [1, 3, 5] },
  {
    choreId: 'chore-emma-clear-table',
    name: 'Clear table',
    amountCents: 50,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  { choreId: 'chore-emma-laundry', name: 'Laundry', amountCents: 150, days: [0] },
];

const LUCAS_CHORES: ChoreTemplate[] = [
  {
    choreId: 'chore-lucas-feed-cat',
    name: 'Feed the cat',
    amountCents: 50,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  { choreId: 'chore-lucas-tidy-room', name: 'Tidy room', amountCents: 200, days: [3] },
  { choreId: 'chore-lucas-take-out-trash', name: 'Take out trash', amountCents: 75, days: [1, 4] },
];

type CompletionRule = (occurrenceIndex: number, scheduledDate: Date, today: Date) => boolean;

function buildWeekOccurrences(
  weekStart: Date,
  childId: string,
  templates: ChoreTemplate[],
  isCompleted: CompletionRule,
): ChoreOccurrence[] {
  const occurrences: ChoreOccurrence[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let index = 0;

  for (const template of templates) {
    for (let offset = 0; offset < 7; offset += 1) {
      const scheduledDate = addDays(weekStart, offset);
      if (!template.days.includes(scheduledDate.getDay())) continue;

      occurrences.push({
        id: `occ-${template.choreId}-${toISODate(scheduledDate)}`,
        choreId: template.choreId,
        childId,
        name: template.name,
        amountCents: template.amountCents,
        scheduledDate: toISODate(scheduledDate),
        status: isCompleted(index, scheduledDate, today) ? 'completed' : 'pending',
      });
      index += 1;
    }
  }

  return occurrences;
}

function buildWeekSummary(
  id: string,
  childId: string,
  weekStart: Date,
  occurrences: ChoreOccurrence[],
  paymentStatus: WeekSummary['paymentStatus'],
): WeekSummary {
  const earnedCents = calculateEarnedCents(occurrences);
  const paidAmountCents = paymentStatus === 'paid' ? earnedCents : null;
  return {
    id,
    childId,
    weekStart: toISODate(weekStart),
    weekEnd: toISODate(addDays(weekStart, 6)),
    maximumCents: calculateMaximumCents(occurrences),
    earnedCents,
    paymentStatus,
    paidAmountCents,
    occurrences,
  };
}

// --- Children -----------------------------------------------------------

export const children: Child[] = [
  { id: 'child-emma', name: 'Emma' },
  { id: 'child-lucas', name: 'Lucas' },
];

// --- Weeks ----------------------------------------------------------------

const thisMonday = mondayOfWeek(new Date());
const lastMonday = addDays(thisMonday, -7);
const twoWeeksAgoMonday = addDays(thisMonday, -14);

// Current week: a realistic in-progress mix — past days done, today half done,
// future days untouched — so the Week screen has something in every section.
const currentWeekCompletion: CompletionRule = (index, scheduledDate, today) => {
  if (scheduledDate < today) return true;
  if (scheduledDate.getTime() === today.getTime()) return index % 2 === 0;
  return false;
};

// Previous week: fully completed and already paid.
const fullyCompleted: CompletionRule = () => true;

// Two weeks ago: partially completed, never paid.
const partiallyCompleted: CompletionRule = (index) => index % 2 === 0;

function weeksForChild(childId: string, templates: ChoreTemplate[]): WeekSummary[] {
  return [
    buildWeekSummary(
      `week-${childId}-current`,
      childId,
      thisMonday,
      buildWeekOccurrences(thisMonday, childId, templates, currentWeekCompletion),
      'not_paid',
    ),
    buildWeekSummary(
      `week-${childId}-last`,
      childId,
      lastMonday,
      buildWeekOccurrences(lastMonday, childId, templates, fullyCompleted),
      'paid',
    ),
    buildWeekSummary(
      `week-${childId}-two-ago`,
      childId,
      twoWeeksAgoMonday,
      buildWeekOccurrences(twoWeeksAgoMonday, childId, templates, partiallyCompleted),
      'not_paid',
    ),
  ];
}

const weeksByChild: Record<string, WeekSummary[]> = {
  'child-emma': weeksForChild('child-emma', EMMA_CHORES),
  'child-lucas': weeksForChild('child-lucas', LUCAS_CHORES),
};

export function getCurrentWeek(childId: string): WeekSummary {
  const week = weeksByChild[childId]?.[0];
  if (!week) throw new Error(`No mock weeks for child ${childId}`);
  return week;
}

export function getWeekHistory(childId: string): WeekSummary[] {
  return weeksByChild[childId]?.slice(1) ?? [];
}

export function getWeekById(weekId: string): WeekSummary | undefined {
  return Object.values(weeksByChild)
    .flat()
    .find((week) => week.id === weekId);
}
