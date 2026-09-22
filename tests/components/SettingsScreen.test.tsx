import { render, screen } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/settings';

import { withSafeArea } from '../testUtils';

const mockSignOut = jest.fn();

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
    signOut: mockSignOut,
  }),
}));

jest.mock('@/hooks/useFamilyChildren', () => ({
  useFamilyChildren: () => ({
    children: [
      { id: 'child-1', name: 'Emma' },
      { id: 'child-2', name: 'Lucas' },
    ],
    isLoading: false,
    error: null,
  }),
}));

// Covers master spec section 27: settings stays a short, flat list of
// sections, not a nested management dashboard.
describe('SettingsScreen as a parent', () => {
  it('renders every required parent section and each child by name', async () => {
    await render(withSafeArea(<SettingsScreen />));

    expect(screen.getByText('Allowance')).toBeTruthy();
    expect(screen.getByText('Children')).toBeTruthy();
    expect(screen.getByText('Chores')).toBeTruthy();
    expect(screen.getByText('Family')).toBeTruthy();
    expect(screen.getByText('Security')).toBeTruthy();

    expect(screen.getByText('Emma')).toBeTruthy();
    expect(screen.getByText('Lucas')).toBeTruthy();
  });
});
