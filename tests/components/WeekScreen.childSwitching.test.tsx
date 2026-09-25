import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import WeekScreen from '@/app/(tabs)/index';
import { fetchCurrentWeek } from '@/lib/api/weeks';
import type { Child, WeekSummary } from '@/types/domain';

import { withSafeArea } from '../testUtils';

// Unlike WeekScreen.test.tsx's mock, this one keys the underlying
// useEffect off the effect callback's own identity rather than a fixed
// `[]`, so it re-fires whenever the real component's useCallback
// dependencies (selectedChildId, familyId) actually change — needed here
// to simulate "the children list changes after a removal, the screen
// should react to that". (Using no dependency array at all would re-run
// the effect after every render, including ones the effect's own setState
// calls cause, which is an infinite loop.)
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    isLoading: false,
    appState: {
      status: 'active',
      membership: {
        familyId: 'family-1',
        familyName: 'Test Family',
        role: 'parent',
        childId: null,
      },
    },
  }),
}));

let mockChildren: Child[] = [];

jest.mock('@/hooks/useFamilyChildren', () => ({
  useFamilyChildren: () => ({
    children: mockChildren,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/lib/api/weeks', () => ({
  fetchCurrentWeek: jest.fn(),
}));

const mockedFetchCurrentWeek = fetchCurrentWeek as jest.MockedFunction<typeof fetchCurrentWeek>;

function weekFor(childId: string, choreName: string): WeekSummary {
  return {
    id: `week-${childId}`,
    childId,
    childRewardType: 'currency',
    weekStart: '2026-01-01',
    weekEnd: '2026-01-07',
    maximumCents: 100,
    earnedCents: 0,
    paymentStatus: 'not_paid',
    paidAmountCents: null,
    occurrences: [
      {
        id: `occ-${childId}`,
        choreId: `chore-${childId}`,
        childId,
        name: choreName,
        amountCents: 100,
        scheduledDate: '2026-01-01',
        status: 'pending',
      },
    ],
  };
}

beforeEach(() => {
  mockChildren = [
    { id: 'child-1', name: 'Emma', rewardType: 'currency' },
    { id: 'child-2', name: 'Timmy', rewardType: 'currency' },
  ];
  mockedFetchCurrentWeek.mockReset();
  mockedFetchCurrentWeek.mockImplementation(async (childId) =>
    childId === 'child-1'
      ? weekFor('child-1', "Emma's chore")
      : weekFor('child-2', "Timmy's chore"),
  );
});

// Regression test — reported as "I removed a child, went back to the Week
// screen, and their chore was still shown with no name at the top; only
// switching to a different child made it go away." Root cause: the
// explicitly-picked child wasn't revalidated against the current children
// list after a removal.
describe('WeekScreen child switching after a removal', () => {
  it('falls back to a valid child once the explicitly selected one is removed', async () => {
    const { rerender } = await render(withSafeArea(<WeekScreen />));
    await waitFor(() => expect(screen.getByText("Emma's chore")).toBeTruthy());

    // Explicitly switch to Timmy via the child switcher.
    await waitFor(() => expect(screen.getByText('Timmy')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Timmy'));
    });
    await waitFor(() => expect(screen.getByText("Timmy's chore")).toBeTruthy());

    // Timmy gets removed — the children list no longer includes him.
    mockChildren = [{ id: 'child-1', name: 'Emma', rewardType: 'currency' }];
    await act(async () => {
      rerender(withSafeArea(<WeekScreen />));
    });

    // Falls back to Emma instead of staying stuck showing Timmy's stale data.
    await waitFor(() => expect(screen.getByText("Emma's chore")).toBeTruthy());
    expect(screen.queryByText("Timmy's chore")).toBeNull();
  });

  // Regression test — reported as "I deleted Tom and went back to the Week
  // screen; it fell back to Emma, but I could still see Tom's icon in the
  // switcher, and tapping it caused an error." Root cause: the switcher's
  // chips come from switcherSummaries, a *separate* piece of state
  // populated by its own slower async fetch — so even once `children` (and
  // therefore selectedChildId) has already dropped a removed child, the
  // switcher itself kept showing the stale chip until that other fetch
  // eventually caught up, leaving a dangling, tappable chip for a child
  // that no longer exists in the meantime.
  it("hides a removed child's chip as soon as the children list drops them, without waiting for switcher summaries to refetch", async () => {
    mockChildren = [
      { id: 'child-1', name: 'Emma', rewardType: 'currency' },
      { id: 'child-2', name: 'Timmy', rewardType: 'currency' },
      { id: 'child-3', name: 'Tom', rewardType: 'currency' },
    ];

    const pending = new Map<string, Array<(week: WeekSummary) => void>>();
    mockedFetchCurrentWeek.mockReset();
    mockedFetchCurrentWeek.mockImplementation(
      (childId) =>
        new Promise((resolve) => {
          const queue = pending.get(childId) ?? [];
          queue.push(resolve);
          pending.set(childId, queue);
        }),
    );
    function resolveAllPending(childId: string, week: WeekSummary) {
      const queue = pending.get(childId) ?? [];
      queue.forEach((resolve) => resolve(week));
      pending.set(childId, []);
    }

    const { rerender } = await render(withSafeArea(<WeekScreen />));
    await act(async () => {
      resolveAllPending('child-1', weekFor('child-1', "Emma's chore"));
      resolveAllPending('child-2', weekFor('child-2', "Timmy's chore"));
      resolveAllPending('child-3', weekFor('child-3', "Tom's chore"));
    });
    await waitFor(() => expect(screen.getByText('Tom')).toBeTruthy());

    // Tom gets removed. New fetches for the switcher's remaining children
    // are deliberately left unresolved here, simulating that slower
    // refetch still being in flight.
    pending.clear();
    mockChildren = [
      { id: 'child-1', name: 'Emma', rewardType: 'currency' },
      { id: 'child-2', name: 'Timmy', rewardType: 'currency' },
    ];
    await act(async () => {
      rerender(withSafeArea(<WeekScreen />));
    });

    expect(screen.queryByText('Tom')).toBeNull();
  });
});
