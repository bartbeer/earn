import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import JoinFamilyScreen from '@/app/(onboarding)/join-family';
import { resolveFamilyJoinCode } from '@/lib/api/family';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@/lib/api/family', () => ({
  resolveFamilyJoinCode: jest.fn(),
}));

const mockJoinFamily = jest.fn();

jest.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ joinFamily: mockJoinFamily }),
}));

const mockedResolveFamilyJoinCode = resolveFamilyJoinCode as jest.MockedFunction<
  typeof resolveFamilyJoinCode
>;

beforeEach(() => {
  mockedResolveFamilyJoinCode.mockReset();
  mockJoinFamily.mockReset();
});

// Phase 9: a child signs up for their own account normally, then redeems
// the family's join code here to link that account to one of the family's
// existing children.
describe('JoinFamilyScreen', () => {
  it('resolves a valid code and lists the unclaimed children to pick from', async () => {
    mockedResolveFamilyJoinCode.mockResolvedValue({
      familyName: 'The Smiths',
      children: [{ id: 'child-1', name: 'Lucas' }],
    });

    await render(<JoinFamilyScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Join code'), '123456');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Find my family'));
    });

    expect(mockedResolveFamilyJoinCode).toHaveBeenCalledWith('123456');
    await waitFor(() => expect(screen.getByText('Lucas')).toBeTruthy());
    expect(screen.getByText(/The Smiths/)).toBeTruthy();
  });

  it('shows an error for an invalid or expired code', async () => {
    mockedResolveFamilyJoinCode.mockRejectedValue(new Error('Invalid or expired join code'));

    await render(<JoinFamilyScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Join code'), '000000');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Find my family'));
    });

    expect(
      screen.getByText("That code isn't valid — check with your parent and try again."),
    ).toBeTruthy();
  });

  it('shows a message when every child in the family has already joined', async () => {
    mockedResolveFamilyJoinCode.mockResolvedValue({ familyName: 'The Smiths', children: [] });

    await render(<JoinFamilyScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Join code'), '123456');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Find my family'));
    });

    await waitFor(() =>
      expect(
        screen.getByText('Everyone in this family has already joined. Ask a parent for help.'),
      ).toBeTruthy(),
    );
  });

  it('joins as the selected child once picked and confirmed', async () => {
    mockedResolveFamilyJoinCode.mockResolvedValue({
      familyName: 'The Smiths',
      children: [
        { id: 'child-1', name: 'Lucas' },
        { id: 'child-2', name: 'Mia' },
      ],
    });
    mockJoinFamily.mockResolvedValue(undefined);

    await render(<JoinFamilyScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Join code'), '123456');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Find my family'));
    });
    await waitFor(() => expect(screen.getByText('Mia')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Mia'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Join'));
    });

    expect(mockJoinFamily).toHaveBeenCalledWith('123456', 'child-2');
  });

  it('shows an error when joining fails', async () => {
    mockedResolveFamilyJoinCode.mockResolvedValue({
      familyName: 'The Smiths',
      children: [{ id: 'child-1', name: 'Lucas' }],
    });
    mockJoinFamily.mockRejectedValue(new Error('This child has already joined'));

    await render(<JoinFamilyScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Join code'), '123456');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Find my family'));
    });
    await waitFor(() => expect(screen.getByText('Lucas')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Lucas'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Join'));
    });

    expect(screen.getByText("Couldn't join. Try again.")).toBeTruthy();
  });
});
