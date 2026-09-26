import { describeFailure, isRateLimitError } from '@/lib/errorMessages';

// Phase 10: distinguishing "you're offline" from every other failure. The
// OfflineBanner already warns proactively, but repeating it at the exact
// point something failed confirms *why*, instead of always showing the
// same generic message regardless of cause (section 87: never surface raw
// backend errors, but "you're offline" isn't a raw backend error).
describe('describeFailure', () => {
  it('returns an offline-specific message when offline', () => {
    expect(describeFailure(true, "Couldn't save that. Try again.")).toBe(
      "You're offline. Try again once you're back online.",
    );
  });

  it('returns the given fallback message when not offline', () => {
    expect(describeFailure(false, "Couldn't save that. Try again.")).toBe(
      "Couldn't save that. Try again.",
    );
  });

  it('defaults the fallback to a generic save-failure message', () => {
    expect(describeFailure(false)).toBe("Couldn't save that. Try again.");
  });
});

// Phase 12: rate limiting on the Parent PIN and join-code checks needs its
// own distinct message — "wrong guess, try again" would be actively
// misleading once every further guess is rejected regardless of
// correctness.
describe('isRateLimitError', () => {
  it('recognizes the rate-limit error raised by the backend', () => {
    expect(isRateLimitError(new Error('Too many attempts. Try again in a few minutes.'))).toBe(
      true,
    );
  });

  it('does not misidentify an unrelated error', () => {
    expect(isRateLimitError(new Error('Invalid or expired join code'))).toBe(false);
  });

  it('does not misidentify a non-Error value', () => {
    expect(isRateLimitError('Too many attempts')).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });
});
