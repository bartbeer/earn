import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import JoinCodeScreen from '@/app/join-code';
import { useIsOffline } from '@/hooks/useIsOffline';
import { rotateFamilyJoinCode } from '@/lib/api/family';

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

jest.mock('@/lib/api/family', () => ({
  rotateFamilyJoinCode: jest.fn(),
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

const mockedRotateFamilyJoinCode = rotateFamilyJoinCode as jest.MockedFunction<
  typeof rotateFamilyJoinCode
>;
const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

beforeEach(() => {
  mockedRotateFamilyJoinCode.mockReset();
  mockedUseIsOffline.mockReset().mockReturnValue(false);
});

// Phase 9: parent-facing half of the join-code flow — the server only
// ever stores a hash, so this screen is the only place the plaintext code
// is ever shown, and only once per generation.
describe('JoinCodeScreen', () => {
  it('generates and shows a code as soon as the screen opens', async () => {
    mockedRotateFamilyJoinCode.mockResolvedValue('482913');

    await render(<JoinCodeScreen />);

    expect(mockedRotateFamilyJoinCode).toHaveBeenCalledWith('family-1');
    await waitFor(() => expect(screen.getByText('482913')).toBeTruthy());
  });

  it('generates a fresh code when asked for a new one', async () => {
    mockedRotateFamilyJoinCode.mockResolvedValueOnce('111111').mockResolvedValueOnce('222222');

    await render(<JoinCodeScreen />);
    await waitFor(() => expect(screen.getByText('111111')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Generate a new code'));
    });

    await waitFor(() => expect(screen.getByText('222222')).toBeTruthy());
    expect(mockedRotateFamilyJoinCode).toHaveBeenCalledTimes(2);
  });

  it('shows an error when generation fails', async () => {
    mockedRotateFamilyJoinCode.mockRejectedValue(new Error('network error'));

    await render(<JoinCodeScreen />);

    await waitFor(() =>
      expect(screen.getByText("Couldn't generate a code. Try again.")).toBeTruthy(),
    );
  });

  // Phase 10: distinguishes "you're offline" from every other failure.
  it('shows an offline-specific message when generation fails while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockedRotateFamilyJoinCode.mockRejectedValue(new Error('network error'));

    await render(<JoinCodeScreen />);

    await waitFor(() =>
      expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy(),
    );
  });
});
