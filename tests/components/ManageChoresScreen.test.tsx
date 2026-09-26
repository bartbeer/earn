import { render, screen, waitFor } from '@testing-library/react-native';

import ManageChoresScreen from '@/app/manage-chores';
import { fetchChores } from '@/lib/api/chores';
import type { Chore } from '@/types/domain';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, []),
  };
});

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    appState: {
      status: 'active',
      membership: { familyId: 'family-1', familyName: 'Test Family', role: 'parent', childId: null },
    },
  }),
}));

jest.mock('@/hooks/useFamilyChildren', () => ({
  useFamilyChildren: () => ({
    children: [{ id: 'child-1', name: 'Emma', rewardType: 'currency' }],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/lib/api/chores', () => ({
  fetchChores: jest.fn(),
}));

const mockedFetchChores = fetchChores as jest.MockedFunction<typeof fetchChores>;

const roomTidy: Chore = {
  id: 'chore-1',
  familyId: 'family-1',
  childId: 'child-1',
  name: 'Room tidy',
  amountCents: 250,
  recurrenceType: 'daily',
  active: true,
  scheduleDays: [],
};

beforeEach(() => {
  mockedFetchChores.mockReset();
});

// Phase 11: unlike the equivalent History screen card, this row had no
// accessibilityRole/Label at all — a screen reader had nothing but raw,
// unstructured descendant text (and possibly the chevron icon's own glyph)
// to go on.
describe('ManageChoresScreen accessibility', () => {
  it('gives each chore row a single accessible label combining name, child, schedule, and amount', async () => {
    mockedFetchChores.mockResolvedValue([roomTidy]);

    await render(<ManageChoresScreen />);

    await waitFor(() =>
      expect(screen.getByLabelText('Room tidy, Emma, Daily, €2.50')).toBeTruthy(),
    );
  });
});
