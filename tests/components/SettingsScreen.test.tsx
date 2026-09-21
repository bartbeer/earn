import { render, screen } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/settings';

import { withSafeArea } from '../testUtils';

jest.mock('@/lib/mockData', () => ({
  children: [
    { id: 'child-emma', name: 'Emma' },
    { id: 'child-lucas', name: 'Lucas' },
  ],
}));

// Covers master spec section 27: settings stays a short, flat list of
// sections, not a nested management dashboard.
describe('SettingsScreen', () => {
  it('renders every required settings section and each child by name', async () => {
    await render(withSafeArea(<SettingsScreen />));

    expect(screen.getByText('Allowance')).toBeTruthy();
    expect(screen.getByText('Children')).toBeTruthy();
    expect(screen.getByText('Chores')).toBeTruthy();
    expect(screen.getByText('Family')).toBeTruthy();
    expect(screen.getByText('Security')).toBeTruthy();

    expect(screen.getByText('Emma')).toBeTruthy();
    expect(screen.getByText('Lucas')).toBeTruthy();
  });
});
