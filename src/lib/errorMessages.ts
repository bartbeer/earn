// Phase 10: a shared way to distinguish "you're offline" from every other
// failure. Screens already catch and show a generic, deliberately vague
// message on failure (section 87: never surface raw backend errors) — this
// swaps that message specifically when the cause is no network connection,
// since "you're offline" is worth saying plainly rather than folding into
// a generic "try again".

/** Default fallback for a routine save/submit action that failed for a non-offline reason. */
export const GENERIC_SAVE_FAILURE = "Couldn't save that. Try again.";

export function describeFailure(isOffline: boolean, fallback: string = GENERIC_SAVE_FAILURE): string {
  return isOffline ? "You're offline. Try again once you're back online." : fallback;
}

/**
 * Phase 12: whether an error is the rate-limit rejection raised by
 * verify_parent_pin / resolve_family_join_code / join_family_as_child once
 * too many wrong guesses have been made. Matched on message text — there's
 * no structured error code distinguishing this from any other raised
 * exception (a plain `raise exception` always carries SQLSTATE P0001) —
 * fragile if the backend's wording ever changes, but the two are already
 * expected to move together since they live in the same migration.
 */
export function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Too many attempts');
}
