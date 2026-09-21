// Smoke test proving the Jest + TypeScript test pipeline is wired up correctly.
// Real business-logic unit tests (money math, week boundaries, recurrence, etc.)
// are added test-first in their respective phases.
describe('test infrastructure', () => {
  it('runs TypeScript unit tests', () => {
    expect(1 + 1).toBe(2);
  });
});
