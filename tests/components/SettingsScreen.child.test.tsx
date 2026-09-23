import { render, screen } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/settings';

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
    signOut: jest.fn(),
  }),
}));

jest.mock('@/hooks/useFamilyChildren', () => ({
  useFamilyChildren: () => ({ children: [], isLoading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('@/lib/api/family', () => ({
  deactivateChild: jest.fn(),
}));

// Section 7: children must not get access to parent management functionality.
describe('SettingsScreen as a child', () => {
  it('hides every parent-only section, keeping only Account', async () => {
    await render(withSafeArea(<SettingsScreen />));

    expect(screen.queryByText('Allowance')).toBeNull();
    expect(screen.queryByText('Children')).toBeNull();
    expect(screen.queryByText('Chores')).toBeNull();
    expect(screen.queryByText('Family')).toBeNull();
    expect(screen.queryByText('Security')).toBeNull();

    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
  });
});
