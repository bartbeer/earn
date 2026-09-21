import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WeekScreen from '@/app/(tabs)/index';

import { withSafeArea } from '../testUtils';

jest.mock('@/lib/mockData', () => {
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const child = { id: 'child-emma', name: 'Emma' };
  const occurrences = [
    {
      id: 'occ-room-tidy',
      choreId: 'chore-room-tidy',
      childId: child.id,
      name: 'Room tidy',
      amountCents: 250,
      scheduledDate: todayISO,
      status: 'pending',
    },
    {
      id: 'occ-dishwasher',
      choreId: 'chore-dishwasher',
      childId: child.id,
      name: 'Dishwasher',
      amountCents: 50,
      scheduledDate: todayISO,
      status: 'completed',
    },
  ];

  return {
    children: [child],
    getCurrentWeek: () => ({
      id: 'week-mock',
      childId: child.id,
      weekStart: todayISO,
      weekEnd: todayISO,
      maximumCents: 300,
      earnedCents: 50,
      paymentStatus: 'not_paid',
      paidAmountCents: null,
      occurrences,
    }),
    getWeekHistory: () => [],
    getWeekById: () => undefined,
  };
});

// Fake timers make the simulated load delay deterministic instead of racing
// a real 300ms setTimeout against the test.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function renderLoaded() {
  await render(withSafeArea(<WeekScreen />));
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

// Covers the two most important interaction guarantees from master spec
// section 59: a loading state renders, and checking a chore updates the
// earned amount immediately.
describe('WeekScreen', () => {
  it('shows a loading state before the chore list appears', async () => {
    await render(withSafeArea(<WeekScreen />));
    expect(screen.getByLabelText('Loading')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByLabelText('Loading')).toBeNull();
    expect(screen.getByText('Room tidy')).toBeTruthy();
  });

  it('updates the earned amount immediately when a chore is checked', async () => {
    await renderLoaded();

    expect(screen.getByText('€0.50 / €3.00')).toBeTruthy();

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
});
