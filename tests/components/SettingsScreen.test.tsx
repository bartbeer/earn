import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import {
  deactivateChild,
  forceSwitchChildRewardType,
  hasParentPin,
  updateChildRewardType,
  verifyParentPin,
} from '@/lib/api/family';

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
  forceSwitchChildRewardType: jest.fn(),
  hasParentPin: jest.fn(),
  verifyParentPin: jest.fn(),
}));

const mockedDeactivateChild = deactivateChild as jest.MockedFunction<typeof deactivateChild>;
const mockedUpdateChildRewardType = updateChildRewardType as jest.MockedFunction<
  typeof updateChildRewardType
>;
const mockedForceSwitchChildRewardType = forceSwitchChildRewardType as jest.MockedFunction<
  typeof forceSwitchChildRewardType
>;
const mockedHasParentPin = hasParentPin as jest.MockedFunction<typeof hasParentPin>;
const mockedVerifyParentPin = verifyParentPin as jest.MockedFunction<typeof verifyParentPin>;

function pressAlertButton(alertSpy: jest.SpyInstance, text: string) {
  const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const button = buttons?.find((b: { text?: string }) => b.text === text);
  return button?.onPress?.();
}

async function renderUnlocked() {
  mockedHasParentPin.mockResolvedValue(false);
  await render(withSafeArea(<SettingsScreen />));
  await waitFor(() => expect(screen.getByText('Emma')).toBeTruthy());
}

beforeEach(() => {
  mockRefetch.mockReset();
  mockedDeactivateChild.mockReset().mockResolvedValue(undefined);
  mockedUpdateChildRewardType.mockReset().mockResolvedValue(undefined);
  mockedForceSwitchChildRewardType.mockReset().mockResolvedValue(undefined);
  mockedHasParentPin.mockReset();
  mockedVerifyParentPin.mockReset();
});

// Covers master spec section 27: settings stays a short, flat list of
// sections, not a nested management dashboard.
describe('SettingsScreen as a parent', () => {
  it('renders every required parent section, each child by name, and their reward type', async () => {
    await renderUnlocked();

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

    await renderUnlocked();

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

    await renderUnlocked();

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

    await renderUnlocked();

    await act(async () => {
      fireEvent.press(screen.getByText('Lucas'));
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Switch to Euros');
    });

    expect(mockedUpdateChildRewardType).toHaveBeenCalledWith('child-2', 'currency');

    alertSpy.mockRestore();
  });

  // The server locks the ordinary switch while the child has an active
  // chore or any chore history — the app should offer the explicit,
  // destructive override rather than just failing here (requested
  // directly: "even if the chore is done, I need to be able to switch...
  // all finished chores in history can be removed permanently").
  it('offers a destructive override when the ordinary switch is rejected', async () => {
    mockedUpdateChildRewardType.mockReset().mockRejectedValue(new Error('locked'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await renderUnlocked();

    await act(async () => {
      fireEvent.press(screen.getByText('Emma'));
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Switch to Stars');
    });

    expect(alertSpy).toHaveBeenLastCalledWith(
      "Can't change this yet",
      expect.any(String),
      expect.any(Array),
    );
    expect(mockedForceSwitchChildRewardType).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('force-switches and refreshes once the destructive override is confirmed', async () => {
    mockedUpdateChildRewardType.mockReset().mockRejectedValue(new Error('locked'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await renderUnlocked();

    await act(async () => {
      fireEvent.press(screen.getByText('Emma'));
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Switch to Stars');
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Delete history & switch');
    });

    expect(mockedForceSwitchChildRewardType).toHaveBeenCalledWith('child-1', 'stars');
    expect(mockRefetch).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  // The one boundary that survives even the destructive override: a paid
  // week is never deleted.
  it('explains that a paid week blocks even the destructive override', async () => {
    mockedUpdateChildRewardType.mockReset().mockRejectedValue(new Error('locked'));
    mockedForceSwitchChildRewardType.mockReset().mockRejectedValue(new Error('paid week exists'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await renderUnlocked();

    await act(async () => {
      fireEvent.press(screen.getByText('Emma'));
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Switch to Stars');
    });
    await act(async () => {
      await pressAlertButton(alertSpy, 'Delete history & switch');
    });

    expect(alertSpy).toHaveBeenLastCalledWith("Still can't change this", expect.any(String));
    expect(mockRefetch).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});

// Extra feature: the Parent PIN gates the parent-only sections when one is
// set — a local lock, not a second login, for when a family device
// sometimes ends up in a child's hands while the parent is still signed in.
describe('SettingsScreen Parent PIN gate', () => {
  it('shows the parent sections directly when no PIN is set', async () => {
    await renderUnlocked();

    expect(screen.getByText('Children')).toBeTruthy();
    expect(screen.queryByText('Settings locked')).toBeNull();
  });

  it('shows a PIN entry gate instead of the parent sections when one is set', async () => {
    mockedHasParentPin.mockResolvedValue(true);

    await render(withSafeArea(<SettingsScreen />));

    await waitFor(() => expect(screen.getByText('Settings locked')).toBeTruthy());
    expect(screen.queryByText('Children')).toBeNull();
  });

  it('unlocks and shows the parent sections once the correct PIN is entered', async () => {
    mockedHasParentPin.mockResolvedValue(true);
    mockedVerifyParentPin.mockResolvedValue(true);

    await render(withSafeArea(<SettingsScreen />));
    await waitFor(() => expect(screen.getByText('Settings locked')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Parent PIN'), '4242');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Unlock'));
    });

    expect(mockedVerifyParentPin).toHaveBeenCalledWith('family-1', '4242');
    await waitFor(() => expect(screen.getByText('Children')).toBeTruthy());
  });

  it('shows an error and stays locked for a wrong PIN', async () => {
    mockedHasParentPin.mockResolvedValue(true);
    mockedVerifyParentPin.mockResolvedValue(false);

    await render(withSafeArea(<SettingsScreen />));
    await waitFor(() => expect(screen.getByText('Settings locked')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Parent PIN'), '0000');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Unlock'));
    });

    await waitFor(() => expect(screen.getByText('Wrong PIN. Try again.')).toBeTruthy());
    expect(screen.queryByText('Children')).toBeNull();
  });
});
