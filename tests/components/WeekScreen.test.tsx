import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import WeekScreen from '@/app/(tabs)/index';
import { fetchCurrentWeek } from '@/lib/api/weeks';
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
}));

const mockedFetchCurrentWeek = fetchCurrentWeek as jest.MockedFunction<typeof fetchCurrentWeek>;

const todayISO = new Date().toISOString().slice(0, 10);

const sampleWeek: WeekSummary = {
  id: 'week-1',
  childId: 'child-1',
  weekStart: todayISO,
  weekEnd: todayISO,
  maximumCents: 300,
  earnedCents: 50,
  paymentStatus: 'not_paid',
  paidAmountCents: null,
  occurrences: [
    {
      id: 'occ-room-tidy',
      choreId: 'chore-room-tidy',
      childId: 'child-1',
      name: 'Room tidy',
      amountCents: 250,
      scheduledDate: todayISO,
      status: 'pending',
    },
    {
      id: 'occ-dishwasher',
      choreId: 'chore-dishwasher',
      childId: 'child-1',
      name: 'Dishwasher',
      amountCents: 50,
      scheduledDate: todayISO,
      status: 'completed',
    },
  ],
};

beforeEach(() => {
  mockedFetchCurrentWeek.mockReset();
});

// Covers the two most important interaction guarantees from master spec
// section 59: a loading state renders, and checking a chore updates the
// earned amount immediately.
describe('WeekScreen', () => {
  it('shows a loading state before the fetched chore list appears', async () => {
    let resolveFetch: (value: WeekSummary) => void = () => {};
    mockedFetchCurrentWeek.mockImplementation(
      () => new Promise((resolve) => (resolveFetch = resolve)),
    );

    await render(withSafeArea(<WeekScreen />));
    expect(screen.getByLabelText('Loading')).toBeTruthy();

    await act(async () => {
      resolveFetch(sampleWeek);
    });

    await waitFor(() => expect(screen.queryByLabelText('Loading')).toBeNull());
    expect(screen.getByText('Room tidy')).toBeTruthy();
  });

  it('updates the earned amount immediately when a chore is checked', async () => {
    mockedFetchCurrentWeek.mockResolvedValue(sampleWeek);

    await render(withSafeArea(<WeekScreen />));
    await waitFor(() => expect(screen.getByText('€0.50 / €3.00')).toBeTruthy());

    const checkbox = screen.getByRole('checkbox', { name: /Room tidy/ });
    expect(checkbox.props.accessibilityState.checked).toBe(false);

    await act(async () => {
      fireEvent.press(checkbox);
    });

    expect(screen.getByText('€3.00 / €3.00')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /Room tidy/ }).props.accessibilityState.checked,
    ).toBe(true);
  });

  it('shows an empty state when the child has no chores this week', async () => {
    mockedFetchCurrentWeek.mockResolvedValue(null);

    await render(withSafeArea(<WeekScreen />));

    await waitFor(() => expect(screen.getByText('Nothing planned yet.')).toBeTruthy());
  });
});
