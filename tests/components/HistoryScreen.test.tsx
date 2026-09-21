import { render, screen } from '@testing-library/react-native';

import HistoryScreen from '@/app/(tabs)/history';

import { withSafeArea } from '../testUtils';

jest.mock('@/lib/mockData', () => {
  const child = { id: 'child-emma', name: 'Emma' };
  const currentWeek = {
    id: 'week-current',
    childId: child.id,
    weekStart: '2026-09-14',
    weekEnd: '2026-09-20',
    maximumCents: 500,
    earnedCents: 200,
    paymentStatus: 'not_paid',
    paidAmountCents: null,
    occurrences: [],
  };
  const pastWeeks = [
    {
      ...currentWeek,
      id: 'week-paid',
      weekStart: '2026-09-07',
      weekEnd: '2026-09-13',
      earnedCents: 500,
      paymentStatus: 'paid',
      paidAmountCents: 500,
    },
    {
      ...currentWeek,
      id: 'week-unpaid',
      weekStart: '2026-08-31',
      weekEnd: '2026-09-06',
      earnedCents: 300,
      paymentStatus: 'not_paid',
    },
  ];

  return {
    children: [child],
    getCurrentWeek: () => currentWeek,
    getWeekHistory: () => pastWeeks,
    getWeekById: (id: string) => pastWeeks.find((week) => week.id === id),
  };
});

// Covers master spec section 25: history just needs to show what happened
// each week and its paid/not-paid status — no graphs, no scores.
describe('HistoryScreen', () => {
  it('lists past weeks with their earned amount and payment status', async () => {
    await render(withSafeArea(<HistoryScreen />));

    expect(screen.getByText('€5.00 / €5.00')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();

    expect(screen.getByText('€3.00 / €5.00')).toBeTruthy();
    expect(screen.getByText('Not paid')).toBeTruthy();
  });
});
