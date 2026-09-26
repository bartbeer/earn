import { describeFailure } from '@/lib/errorMessages';

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
