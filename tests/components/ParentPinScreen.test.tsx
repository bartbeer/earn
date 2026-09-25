import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ParentPinScreen from '@/app/parent-pin';
import { clearParentPin, hasParentPin, setParentPin } from '@/lib/api/family';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
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

beforeEach(() => {
  mockBack.mockReset();
  mockedHasParentPin.mockReset();
  mockedSetParentPin.mockReset().mockResolvedValue(undefined);
  mockedClearParentPin.mockReset().mockResolvedValue(undefined);
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
});
