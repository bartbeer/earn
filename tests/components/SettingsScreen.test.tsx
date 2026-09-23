import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { deactivateChild } from '@/lib/api/family';

import { withSafeArea } from '../testUtils';

const mockSignOut = jest.fn();
const mockRefetch = jest.fn();

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
    refetch: mockRefetch,
  }),
}));

jest.mock('@/lib/api/family', () => ({
  deactivateChild: jest.fn(),
}));

const mockedDeactivateChild = deactivateChild as jest.MockedFunction<typeof deactivateChild>;

beforeEach(() => {
  mockRefetch.mockReset();
  mockedDeactivateChild.mockReset().mockResolvedValue(undefined);
});

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

  // Removing a child is exactly the kind of hard-to-reverse action that
  // does get a confirmation, unlike the deliberately confirmation-free
  // checkbox interaction (section 15).
  it('removes a child only after confirming, then refreshes the list', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const removeButton = buttons?.find((b) => b.text === 'Remove');
      removeButton?.onPress?.();
    });

    await render(withSafeArea(<SettingsScreen />));

    await act(async () => {
      fireEvent.press(screen.getByText('Emma'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Remove Emma?', expect.any(String), expect.any(Array));
    expect(mockedDeactivateChild).toHaveBeenCalledWith('child-1');
    expect(mockRefetch).toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
