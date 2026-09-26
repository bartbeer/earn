import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AddChildScreen from '@/app/add-child';
import { useIsOffline } from '@/hooks/useIsOffline';

import { withSafeArea } from '../testUtils';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
}));

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

const mockAddChild = jest.fn();

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ addChild: mockAddChild }),
}));

const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

beforeEach(() => {
  mockBack.mockReset();
  mockAddChild.mockReset();
  mockedUseIsOffline.mockReset().mockReturnValue(false);
});

// Reported: adding a child left the parent stuck on this screen, expecting
// to have to tap a separate "Done" button afterwards. One add is the whole
// job of this screen — a second child means visiting it again from
// Settings, not staying here to add another (master spec section 59).
describe('AddChildScreen', () => {
  it('returns to the previous screen immediately after successfully adding a child', async () => {
    mockAddChild.mockResolvedValue(undefined);
    await render(withSafeArea(<AddChildScreen />));

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Name'), 'Tom');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Add child'));
    });

    expect(mockAddChild).toHaveBeenCalledWith('Tom', 'currency');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('stays on the screen and shows an error when adding fails', async () => {
    mockAddChild.mockRejectedValue(new Error('network error'));
    await render(withSafeArea(<AddChildScreen />));

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Name'), 'Tom');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Add child'));
    });

    expect(screen.getByText("Couldn't add that child. Try again.")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  // Extra feature: some parents don't want a younger child working for
  // real money — stars is a non-monetary alternative, chosen at add time.
  it('adds the child with the stars reward type once selected', async () => {
    mockAddChild.mockResolvedValue(undefined);
    await render(withSafeArea(<AddChildScreen />));

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Name'), 'Tom');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Stars'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Add child'));
    });

    expect(mockAddChild).toHaveBeenCalledWith('Tom', 'stars');
  });

  it('defaults to euros without any selection', async () => {
    mockAddChild.mockResolvedValue(undefined);
    await render(withSafeArea(<AddChildScreen />));

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Name'), 'Tom');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Add child'));
    });

    expect(mockAddChild).toHaveBeenCalledWith('Tom', 'currency');
  });

  // Phase 10: distinguishes "you're offline" from every other save failure.
  it('shows an offline-specific message when adding fails while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockAddChild.mockRejectedValue(new Error('network error'));
    await render(withSafeArea(<AddChildScreen />));

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Name'), 'Tom');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Add child'));
    });

    expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy();
  });
});
