import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import ForgotPasswordScreen from '@/app/(auth)/forgot-password';
import { useIsOffline } from '@/hooks/useIsOffline';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

const mockRequestPasswordReset = jest.fn();
const mockConfirmPasswordReset = jest.fn();

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    requestPasswordReset: mockRequestPasswordReset,
    confirmPasswordReset: mockConfirmPasswordReset,
  }),
}));

const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

beforeEach(() => {
  mockRequestPasswordReset.mockReset();
  mockConfirmPasswordReset.mockReset();
  mockedUseIsOffline.mockReset().mockReturnValue(false);
});

// A forgotten password previously left a parent (or a child with their own
// account) permanently locked out — no reset flow existed at all.
describe('ForgotPasswordScreen', () => {
  it('sends a code to the entered email and reveals the code/password fields', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    await render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Send code'));
    });

    expect(mockRequestPasswordReset).toHaveBeenCalledWith('parent@earn.app');
    expect(screen.getByLabelText('Code')).toBeTruthy();
    expect(screen.getByLabelText('New password')).toBeTruthy();
  });

  // Never reveals whether the email actually has an account — matches
  // Supabase's own resetPasswordForEmail behaviour, so this can't be used
  // to enumerate registered emails.
  it('does not reveal whether the email has an account, even for one that fails to send', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    await render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'nobody@earn.app');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Send code'));
    });

    expect(
      screen.getByText(/we.ve sent it a 6-digit code/),
    ).toBeTruthy();
  });

  it('shows an error when sending the code fails', async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error('network error'));
    await render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Send code'));
    });

    expect(screen.getByText("Couldn't send that. Try again.")).toBeTruthy();
    expect(screen.queryByLabelText('Code')).toBeNull();
  });

  it('resets the password with the entered code and new password', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    mockConfirmPasswordReset.mockResolvedValue(undefined);
    await render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Send code'));
    });

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Code'), '123456');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('New password'), 'newSecurePass123');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Reset password'));
    });

    expect(mockConfirmPasswordReset).toHaveBeenCalledWith(
      'parent@earn.app',
      '123456',
      'newSecurePass123',
    );
  });

  it('shows an error for a wrong or expired code', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    mockConfirmPasswordReset.mockRejectedValue(new Error('Token has expired or is invalid'));
    await render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Send code'));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Code'), '000000');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('New password'), 'newSecurePass123');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Reset password'));
    });

    expect(screen.getByText("That code isn't right, or it's expired. Try again.")).toBeTruthy();
  });

  it('can resend the code', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    await render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Send code'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Resend code'));
    });

    expect(mockRequestPasswordReset).toHaveBeenCalledTimes(2);
  });

  it('shows an offline-specific message when sending the code fails while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    mockRequestPasswordReset.mockRejectedValue(new Error('network error'));
    await render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'parent@earn.app');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Send code'));
    });

    expect(screen.getByText("You're offline. Try again once you're back online.")).toBeTruthy();
  });
});
