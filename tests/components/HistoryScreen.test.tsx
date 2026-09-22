import { render, screen, waitFor } from '@testing-library/react-native';

import HistoryScreen from '@/app/(tabs)/history';
import { fetchWeekHistory } from '@/lib/api/weeks';
import type { WeekSummary } from '@/types/domain';

import { withSafeArea } from '../testUtils';

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    isLoading: false,
    appState: {
      status: 'active',
      membership: {
        familyId: 'family-1',
        familyName: 'Test Family',
        role: 'child',
        childId: 'child-1',
      },
    },
  }),
}));

jest.mock('@/hooks/useFamilyChildren', () => ({
  useFamilyChildren: () => ({ children: [], isLoading: false, error: null }),
}));

jest.mock('@/lib/api/weeks', () => ({
  fetchCurrentWeek: jest.fn(),
  fetchWeekHistory: jest.fn(),
}));

const mockedFetchWeekHistory = fetchWeekHistory as jest.MockedFunction<typeof fetchWeekHistory>;

function makeWeek(overrides: Partial<WeekSummary>): WeekSummary {
  return {
    id: 'week-x',
    childId: 'child-1',
    weekStart: '2026-09-07',
    weekEnd: '2026-09-13',
    maximumCents: 500,
    earnedCents: 200,
    paymentStatus: 'not_paid',
    paidAmountCents: null,
    occurrences: [],
    ...overrides,
  };
}

// Covers master spec section 25: history just needs to show what happened
// each week and its paid/not-paid status — no graphs, no scores.
describe('HistoryScreen', () => {
  it('lists past weeks with their earned amount and payment status', async () => {
    mockedFetchWeekHistory.mockResolvedValue([
      makeWeek({ id: 'week-paid', earnedCents: 500, paymentStatus: 'paid', paidAmountCents: 500 }),
      makeWeek({ id: 'week-unpaid', earnedCents: 300, paymentStatus: 'not_paid' }),
    ]);

    await render(withSafeArea(<HistoryScreen />));

    await waitFor(() => expect(screen.getByText('€5.00 / €5.00')).toBeTruthy());
    expect(screen.getByText('Paid')).toBeTruthy();

    expect(screen.getByText('€3.00 / €5.00')).toBeTruthy();
    expect(screen.getByText('Not paid')).toBeTruthy();
  });

  it('shows an empty state when there are no previous weeks', async () => {
    mockedFetchWeekHistory.mockResolvedValue([]);

    await render(withSafeArea(<HistoryScreen />));

    await waitFor(() => expect(screen.getByText('No previous weeks yet.')).toBeTruthy());
  });
});
