import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { deactivateChild, updateChildRewardType } from '@/lib/api/family';

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
      { id: 'child-1', name: 'Emma', rewardType: 'currency' },
      { id: 'child-2', name: 'Lucas', rewardType: 'stars' },
    ],
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

jest.mock('@/lib/api/family', () => ({
  deactivateChild: jest.fn(),
  updateChildRewardType: jest.fn(),
}));

const mockedDeactivateChild = deactivateChild as jest.MockedFunction<typeof deactivateChild>;
const mockedUpdateChildRewardType = updateChildRewardType as jest.MockedFunction<
  typeof updateChildRewardType
>;

function pressAlertButton(alertSpy: jest.SpyInstance, text: string) {
  const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const button = buttons?.find((b: { text?: string }) => b.text === text);
  return button?.onPress?.();
}

beforeEach(() => {
  mockRefetch.mockReset();
  mockedDeactivateChild.mockReset().mockResolvedValue(undefined);
  mockedUpdateChildRewardType.mockReset().mockResolvedValue(undefined);
});

// Covers master spec section 27: settings stays a short, flat list of
// sections, not a nested management dashboard.
describe('SettingsScreen as a parent', () => {
  it('renders every required parent section, each child by name, and their reward type', async () => {
    await render(withSafeArea(<SettingsScreen />));

    expect(screen.getByText('Allowance')).toBeTruthy();
    expect(screen.getByText('Children')).toBeTruthy();
    expect(screen.getByText('Chores')).toBeTruthy();
    expect(screen.getByText('Family')).toBeTruthy();
    expect(screen.getByText('Security')).toBeTruthy();

    expect(screen.getByText('Emma')).toBeTruthy();
    expect(screen.getByText('Euros')).toBeTruthy();
    expect(screen.getByText('Lucas')).toBeTruthy();
    expect(screen.getByText('Stars')).toBeTruthy();
  });

  // Removing a child is exactly the kind of hard-to-reverse action that
  // does get a confirmation, unlike the deliberately confirmation-free
  // checkbox interaction (section 15).
  it('removes a child only after confirming, then refreshes the list', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(withSafeArea(<SettingsScreen />));

    await act(async () => {
      fireEvent.press(screen.getByText('Emma'));
    });
    await act(async () => {
      pressAlertButton(alertSpy, 'Remove');
    });

    expect(alertSpy).toHaveBeenCalledWith('Emma', expect.any(String), expect.any(Array));
    expect(mockedDeactivateChild).toHaveBeenCalledWith('child-1');
    expect(mockRefetch).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  // Extra feature: a parent can switch a child between euros and stars from
  // here, using the same tap-to-confirm affordance as removal.
  it('switches a child to the other reward type, then refreshes the list', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(withSafeArea(<SettingsScreen />));

    await act(async () => {
      fireEvent.press(screen.getByText('Emma'));
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Switch to Stars');
    });

    expect(mockedUpdateChildRewardType).toHaveBeenCalledWith('child-1', 'stars');
    expect(mockRefetch).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('offers switching back to euros for a stars child', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(withSafeArea(<SettingsScreen />));

    await act(async () => {
      fireEvent.press(screen.getByText('Lucas'));
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Switch to Euros');
    });

    expect(mockedUpdateChildRewardType).toHaveBeenCalledWith('child-2', 'currency');

    alertSpy.mockRestore();
  });

  // The server locks reward_type once a child has any chore — this shows
  // up here as updateChildRewardType rejecting, which should explain why
  // rather than fail silently or refresh as if it worked.
  it('explains why the switch failed when the server rejects it (the child already has chores)', async () => {
    mockedUpdateChildRewardType.mockReset().mockRejectedValue(new Error('locked'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(withSafeArea(<SettingsScreen />));

    await act(async () => {
      fireEvent.press(screen.getByText('Emma'));
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Switch to Stars');
    });

    expect(alertSpy).toHaveBeenLastCalledWith("Can't change this", expect.any(String));
    expect(mockRefetch).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
