import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import CreateFamilyScreen from '@/app/(onboarding)/create-family';
import { useIsOffline } from '@/hooks/useIsOffline';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

const mockCreateFamily = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ createFamily: mockCreateFamily, signOut: mockSignOut }),
}));

const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

beforeEach(() => {
  mockCreateFamily.mockReset();
  mockSignOut.mockReset();
  mockedUseIsOffline.mockReset().mockReturnValue(false);
});

describe('CreateFamilyScreen', () => {
  it('creates a family with the entered name', async () => {
    mockCreateFamily.mockResolvedValue(undefined);
    await render(<CreateFamilyScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Family name'), 'The Smiths');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });

    expect(mockCreateFamily).toHaveBeenCalledWith('The Smiths');
  });

  // Reported: a brand-new sign-up with no family yet had no way off this
  // screen at all if they'd meant to join an existing family but got
  // stuck (e.g. a lost join code) — no tabs, no menu, no escape.
  it('signs out when "Wrong account? Sign out" is tapped', async () => {
    await render(<CreateFamilyScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Wrong account? Sign out'));
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  // Phase 10: distinguishes "you're offline" from every other save failure.
  it('shows an offline-specific message when creating a family fails while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockCreateFamily.mockRejectedValue(new Error('network error'));
    await render(<CreateFamilyScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Family name'), 'The Smiths');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });

    expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy();
  });
});
