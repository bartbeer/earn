import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import CreateFamilyScreen from '@/app/(onboarding)/create-family';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

const mockCreateFamily = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ createFamily: mockCreateFamily, signOut: mockSignOut }),
}));

beforeEach(() => {
  mockCreateFamily.mockReset();
  mockSignOut.mockReset();
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
});
