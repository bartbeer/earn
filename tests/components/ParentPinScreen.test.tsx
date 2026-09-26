import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ParentPinScreen from '@/app/parent-pin';
import { useIsOffline } from '@/hooks/useIsOffline';
import { clearParentPin, hasParentPin, setParentPin } from '@/lib/api/family';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
}));

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    appState: {
      status: 'active',
      membership: {
        familyId: 'family-1',
        familyName: 'Test Family',
        role: 'parent',
        childId: null,
      },
    },
  }),
}));

jest.mock('@/lib/api/family', () => ({
  hasParentPin: jest.fn(),
  setParentPin: jest.fn(),
  clearParentPin: jest.fn(),
}));

const mockedHasParentPin = hasParentPin as jest.MockedFunction<typeof hasParentPin>;
const mockedSetParentPin = setParentPin as jest.MockedFunction<typeof setParentPin>;
const mockedClearParentPin = clearParentPin as jest.MockedFunction<typeof clearParentPin>;
const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

beforeEach(() => {
  mockBack.mockReset();
  mockedHasParentPin.mockReset();
  mockedSetParentPin.mockReset().mockResolvedValue(undefined);
  mockedClearParentPin.mockReset().mockResolvedValue(undefined);
  mockedUseIsOffline.mockReset().mockReturnValue(false);
});

// Phase 9: setting/changing/removing the Parent PIN. Reachable only from
// an already-gated Settings screen, so this screen doesn't ask for the
// current PIN again before letting it be changed.
describe('ParentPinScreen', () => {
  it('offers to set a PIN when none exists yet', async () => {
    mockedHasParentPin.mockResolvedValue(false);

    await render(<ParentPinScreen />);

    await waitFor(() => expect(screen.getByText('Set PIN')).toBeTruthy());
    expect(screen.queryByText('Remove PIN')).toBeNull();
  });

  it('rejects a PIN that is not 4 to 6 digits', async () => {
    mockedHasParentPin.mockResolvedValue(false);

    await render(<ParentPinScreen />);
    await waitFor(() => expect(screen.getByText('Set PIN')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('New PIN'), '12');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Set PIN'));
    });

    expect(screen.getByText('PIN must be 4 to 6 digits.')).toBeTruthy();
    expect(mockedSetParentPin).not.toHaveBeenCalled();
  });

  it('saves a valid PIN and goes back', async () => {
    mockedHasParentPin.mockResolvedValue(false);

    await render(<ParentPinScreen />);
    await waitFor(() => expect(screen.getByText('Set PIN')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('New PIN'), '4242');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Set PIN'));
    });

    expect(mockedSetParentPin).toHaveBeenCalledWith('family-1', '4242');
    expect(mockBack).toHaveBeenCalled();
  });

  it('offers Change and Remove when a PIN already exists', async () => {
    mockedHasParentPin.mockResolvedValue(true);

    await render(<ParentPinScreen />);

    await waitFor(() => expect(screen.getByText('Change PIN')).toBeTruthy());
    expect(screen.getByText('Remove PIN')).toBeTruthy();
  });

  it('removes the PIN only after confirming', async () => {
    mockedHasParentPin.mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const removeButton = buttons?.find((b) => b.text === 'Remove');
      removeButton?.onPress?.();
    });

    await render(<ParentPinScreen />);
    await waitFor(() => expect(screen.getByText('Remove PIN')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Remove PIN'));
    });

    expect(mockedClearParentPin).toHaveBeenCalledWith('family-1');
    expect(mockBack).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  // Phase 10: distinguishes "you're offline" from every other save failure.
  it('shows an offline-specific message when saving fails while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockedHasParentPin.mockResolvedValue(false);
    mockedSetParentPin.mockReset().mockRejectedValue(new Error('network error'));

    await render(<ParentPinScreen />);
    await waitFor(() => expect(screen.getByText('Set PIN')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('New PIN'), '4242');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Set PIN'));
    });

    expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy();
  });

  it('shows an offline-specific error when removing fails while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockedHasParentPin.mockResolvedValue(true);
    mockedClearParentPin.mockReset().mockRejectedValue(new Error('network error'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const removeButton = buttons?.find((b) => b.text === 'Remove');
      removeButton?.onPress?.();
    });

    await render(<ParentPinScreen />);
    await waitFor(() => expect(screen.getByText('Remove PIN')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Remove PIN'));
    });

    expect(mockBack).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy(),
    );

    alertSpy.mockRestore();
  });
});
