import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import WeekDetailScreen from '@/app/history/[weekId]';
import { useIsOffline } from '@/hooks/useIsOffline';
import { fetchWeekById, setWeekPaymentStatus } from '@/lib/api/weeks';
import type { WeekSummary } from '@/types/domain';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ weekId: 'week-1' }),
}));

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

jest.mock('@/lib/api/weeks', () => ({
  fetchWeekById: jest.fn(),
  setWeekPaymentStatus: jest.fn(),
}));

const mockedFetchWeekById = fetchWeekById as jest.MockedFunction<typeof fetchWeekById>;
const mockedSetWeekPaymentStatus = setWeekPaymentStatus as jest.MockedFunction<
  typeof setWeekPaymentStatus
>;
const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

function makeWeek(overrides: Partial<WeekSummary> = {}): WeekSummary {
  return {
    id: 'week-1',
    childId: 'child-1',
    childRewardType: 'currency',
    weekStart: '2026-09-07',
    weekEnd: '2026-09-13',
    maximumCents: 500,
    earnedCents: 300,
    paymentStatus: 'not_paid',
    paidAmountCents: null,
    occurrences: [
      {
        id: 'occ-1',
        choreId: 'chore-1',
        childId: 'child-1',
        name: 'Room tidy',
        amountCents: 300,
        scheduledDate: '2026-09-08',
        status: 'completed',
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mockedFetchWeekById.mockReset();
  mockedSetWeekPaymentStatus.mockReset();
  mockedUseIsOffline.mockReset().mockReturnValue(false);
});

// Phase 8: "Mark as paid" was UI-only since Phase 1-3 — it reset on every
// remount because nothing ever wrote it back. This is the real backend
// write, following the checkbox toggle's optimistic-then-reconcile pattern.
describe('WeekDetailScreen payment status', () => {
  it('marks the week paid, snapshotting whatever the server returns', async () => {
    mockedFetchWeekById.mockResolvedValue(makeWeek());
    mockedSetWeekPaymentStatus.mockResolvedValue({ paymentStatus: 'paid', paidAmountCents: 300 });

    await render(<WeekDetailScreen />);
    await waitFor(() => expect(screen.getByText('Mark as paid')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Mark as paid'));
    });

    expect(mockedSetWeekPaymentStatus).toHaveBeenCalledWith('week-1', true);
    await waitFor(() => expect(screen.getByText('Paid ✓')).toBeTruthy());
  });

  it('rolls back and shows an error when marking paid fails', async () => {
    mockedFetchWeekById.mockResolvedValue(makeWeek());
    mockedSetWeekPaymentStatus.mockRejectedValue(new Error('week has not ended yet'));

    await render(<WeekDetailScreen />);
    await waitFor(() => expect(screen.getByText('Mark as paid')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Mark as paid'));
    });

    await waitFor(() => expect(screen.getByText('Mark as paid')).toBeTruthy());
    expect(screen.getByText("Couldn't save that. Try again.")).toBeTruthy();
  });

  it('undoes payment, clearing the paid amount', async () => {
    mockedFetchWeekById.mockResolvedValue(
      makeWeek({ paymentStatus: 'paid', paidAmountCents: 300 }),
    );
    mockedSetWeekPaymentStatus.mockResolvedValue({ paymentStatus: 'not_paid', paidAmountCents: null });

    await render(<WeekDetailScreen />);
    await waitFor(() => expect(screen.getByText('Paid ✓')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Paid ✓'));
    });

    expect(mockedSetWeekPaymentStatus).toHaveBeenCalledWith('week-1', false);
    await waitFor(() => expect(screen.getByText('Mark as paid')).toBeTruthy());
  });

  it('ignores a repeated tap while a save is already in flight', async () => {
    mockedFetchWeekById.mockResolvedValue(makeWeek());
    mockedSetWeekPaymentStatus.mockImplementation(() => new Promise(() => {})); // never resolves

    await render(<WeekDetailScreen />);
    await waitFor(() => expect(screen.getByText('Mark as paid')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Mark as paid'));
    });
    await waitFor(() => expect(screen.getByText('Saving…')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Saving…'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Saving…'));
    });

    expect(mockedSetWeekPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it('labels the button for a stars child instead of implying real money', async () => {
    mockedFetchWeekById.mockResolvedValue(makeWeek({ childRewardType: 'stars' }));

    await render(<WeekDetailScreen />);

    await waitFor(() => expect(screen.getByText('Mark as given')).toBeTruthy());
  });

  it('labels the paid button as given for a stars child', async () => {
    mockedFetchWeekById.mockResolvedValue(
      makeWeek({ childRewardType: 'stars', paymentStatus: 'paid', paidAmountCents: 300 }),
    );

    await render(<WeekDetailScreen />);

    await waitFor(() => expect(screen.getByText('Given ✓')).toBeTruthy());
  });

  // Phase 10: distinguishes "you're offline" from every other failure.
  it('shows an offline-specific message when marking paid fails while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockedFetchWeekById.mockResolvedValue(makeWeek());
    mockedSetWeekPaymentStatus.mockRejectedValue(new Error('network error'));

    await render(<WeekDetailScreen />);
    await waitFor(() => expect(screen.getByText('Mark as paid')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Mark as paid'));
    });

    await waitFor(() =>
      expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy(),
    );
  });
});
