import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import WeekScreen from '@/app/(tabs)/index';
import { fetchCurrentWeek, setOccurrenceCompletion } from '@/lib/api/weeks';
import type { ChoreOccurrence, WeekSummary } from '@/types/domain';

import { withSafeArea } from '../testUtils';

// useFocusEffect needs a real NavigationContainer, which isn't present when
// rendering a screen in isolation — mocked via a real useEffect (not
// invoked synchronously) so it still runs post-render, just without the
// "only when this screen is focused" part real navigation would add.
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, []),
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
  setOccurrenceCompletion: jest.fn(),
}));

const mockedFetchCurrentWeek = fetchCurrentWeek as jest.MockedFunction<typeof fetchCurrentWeek>;
const mockedSetOccurrenceCompletion = setOccurrenceCompletion as jest.MockedFunction<
  typeof setOccurrenceCompletion
>;

const todayISO = new Date().toISOString().slice(0, 10);

const roomTidy: ChoreOccurrence = {
  id: 'occ-room-tidy',
  choreId: 'chore-room-tidy',
  childId: 'child-1',
  name: 'Room tidy',
  amountCents: 250,
  scheduledDate: todayISO,
  status: 'pending',
};

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
    roomTidy,
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
  mockedSetOccurrenceCompletion.mockReset();
});

// Covers master spec section 59's important-UI-behaviour list: a loading
// state renders, checking a chore updates the earned amount immediately
// (before the network round-trip resolves — section 15's "should feel
// instant"), a failed save rolls back, and rapid repeated taps don't fire
// more than one request (section 64's double-tap protection).
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

  it('updates the earned amount immediately, before the save request resolves', async () => {
    mockedFetchCurrentWeek.mockResolvedValue(sampleWeek);
    let resolveSave: (value: ChoreOccurrence) => void = () => {};
    mockedSetOccurrenceCompletion.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );

    await render(withSafeArea(<WeekScreen />));
    await waitFor(() => expect(screen.getByText('€0.50 / €3.00')).toBeTruthy());

    const checkbox = screen.getByRole('checkbox', { name: /Room tidy/ });
    await act(async () => {
      fireEvent.press(checkbox);
    });

    // Optimistic: updated before setOccurrenceCompletion's promise ever resolves.
    expect(screen.getByText('€3.00 / €3.00')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /Room tidy/ }).props.accessibilityState.checked,
    ).toBe(true);
    expect(mockedSetOccurrenceCompletion).toHaveBeenCalledWith('occ-room-tidy', true);

    await act(async () => {
      resolveSave({ ...roomTidy, status: 'completed' });
    });
    expect(screen.getByText('€3.00 / €3.00')).toBeTruthy();
  });

  it('rolls back the optimistic update and shows an error when saving fails', async () => {
    mockedFetchCurrentWeek.mockResolvedValue(sampleWeek);
    let rejectSave: (error: Error) => void = () => {};
    mockedSetOccurrenceCompletion.mockImplementation(
      () => new Promise((_resolve, reject) => (rejectSave = reject)),
    );

    await render(withSafeArea(<WeekScreen />));
    await waitFor(() => expect(screen.getByText('€0.50 / €3.00')).toBeTruthy());

    const checkbox = screen.getByRole('checkbox', { name: /Room tidy/ });
    await act(async () => {
      fireEvent.press(checkbox);
    });
    expect(screen.getByText('€3.00 / €3.00')).toBeTruthy();

    await act(async () => {
      rejectSave(new Error('network error'));
    });

    expect(screen.getByText('€0.50 / €3.00')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /Room tidy/ }).props.accessibilityState.checked,
    ).toBe(false);
    expect(screen.getByText("Couldn't save that. Try again.")).toBeTruthy();
  });

  it('ignores repeated taps on the same chore while a save is already in flight', async () => {
    mockedFetchCurrentWeek.mockResolvedValue(sampleWeek);
    mockedSetOccurrenceCompletion.mockImplementation(() => new Promise(() => {})); // never resolves

    await render(withSafeArea(<WeekScreen />));
    await waitFor(() => expect(screen.getByText('€0.50 / €3.00')).toBeTruthy());

    const checkbox = screen.getByRole('checkbox', { name: /Room tidy/ });
    await act(async () => {
      fireEvent.press(checkbox);
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('checkbox', { name: /Room tidy/ }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('checkbox', { name: /Room tidy/ }));
    });

    expect(mockedSetOccurrenceCompletion).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('checkbox', { name: /Room tidy/ }).props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('shows an empty state when the child has no chores this week', async () => {
    mockedFetchCurrentWeek.mockResolvedValue(null);

    await render(withSafeArea(<WeekScreen />));

    await waitFor(() => expect(screen.getByText('Nothing planned yet.')).toBeTruthy());
  });
});
