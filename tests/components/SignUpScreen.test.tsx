import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SignUpScreen from '@/app/(auth)/sign-up';
import { useIsOffline } from '@/hooks/useIsOffline';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

const mockSignUp = jest.fn();

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}));

const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

beforeEach(() => {
  mockSignUp.mockReset();
  mockedUseIsOffline.mockReset().mockReturnValue(false);
});

describe('SignUpScreen', () => {
  it('creates an account with the entered details', async () => {
    mockSignUp.mockResolvedValue(undefined);
    await render(<SignUpScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Your name'), 'Bart');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'bart@earn.app');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });

    expect(mockSignUp).toHaveBeenCalledWith('bart@earn.app', 'password123', 'Bart');
  });

  it('shows a generic error when sign-up fails', async () => {
    mockSignUp.mockRejectedValue(new Error('already registered'));
    await render(<SignUpScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Your name'), 'Bart');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'bart@earn.app');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });

    expect(
      screen.getByText("Couldn't create your account. Try a different email or a longer password."),
    ).toBeTruthy();
  });

  // Phase 10: distinguishes "you're offline" from every other failure.
  it('shows an offline-specific message when sign-up fails while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockSignUp.mockRejectedValue(new Error('network error'));
    await render(<SignUpScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Your name'), 'Bart');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'bart@earn.app');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });

    expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy();
  });
});
