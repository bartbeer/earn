import { render, screen } from '@testing-library/react-native';

import IndexScreen from '@/app/index';

// Smoke test proving React Native Testing Library can render an Expo Router
// screen. Real screen behaviour is covered once Phase 1 builds the actual UI.
describe('IndexScreen', () => {
  it('renders the placeholder title', async () => {
    await render(<IndexScreen />);

    expect(screen.getByText('Earn!')).toBeTruthy();
  });
});
