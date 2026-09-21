// Small, pure date helpers used for UI grouping (Today / Later this week).
// Full timezone-aware week-boundary logic is a Phase 7 concern — this file
// intentionally stays limited to plain ISO-date (YYYY-MM-DD) comparisons.

/**
 * Formats a Date as a local YYYY-MM-DD string.
 *
 * Deliberately NOT `date.toISOString().slice(0, 10)` — that converts to UTC
 * first, which silently shifts the date near local midnight in any timezone
 * ahead of UTC (e.g. Europe/Brussels), corrupting "today" and weekday grouping.
 */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** True when an occurrence's scheduled date (YYYY-MM-DD) is today's date. */
export function isOccurrenceToday(scheduledDateISO: string, todayISO: string): boolean {
  return scheduledDateISO === todayISO;
}
