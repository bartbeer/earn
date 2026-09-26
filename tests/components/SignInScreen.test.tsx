import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SignInScreen from '@/app/(auth)/sign-in';
import { useIsOffline } from '@/hooks/useIsOffline';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

const mockSignIn = jest.fn();

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

beforeEach(() => {
  mockSignIn.mockReset();
  mockedUseIsOffline.mockReset().mockReturnValue(false);
});

describe('SignInScreen', () => {
  it('signs in with the entered credentials', async () => {
    mockSignIn.mockResolvedValue(undefined);
    await render(<SignInScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(mockSignIn).toHaveBeenCalledWith('parent@earn.app', 'password123');
  });

  it('shows a generic error for bad credentials', async () => {
    mockSignIn.mockRejectedValue(new Error('Invalid login credentials'));
    await render(<SignInScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(
      screen.getByText("Couldn't sign in. Check your email and password and try again."),
    ).toBeTruthy();
  });

  // Phase 10: a network failure previously showed this exact "check your
  // email and password" wording too, wrongly suggesting a typo when the
  // real problem is no connection.
  it('shows an offline-specific message instead of "check your credentials" when offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockSignIn.mockRejectedValue(new Error('network error'));
    await render(<SignInScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy();
    expect(
      screen.queryByText("Couldn't sign in. Check your email and password and try again."),
    ).toBeNull();
  });
});
