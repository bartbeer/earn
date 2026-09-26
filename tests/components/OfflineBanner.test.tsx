import { render, screen } from '@testing-library/react-native';

import { OfflineBanner } from '@/components/OfflineBanner';
import { useIsOffline } from '@/hooks/useIsOffline';

import { withSafeArea } from '../testUtils';

jest.mock('@/hooks/useIsOffline', () => ({
  useIsOffline: jest.fn(),
}));

const mockedUseIsOffline = useIsOffline as jest.MockedFunction<typeof useIsOffline>;

describe('OfflineBanner', () => {
  it('renders nothing while online', async () => {
    mockedUseIsOffline.mockReturnValue(false);
    await render(withSafeArea(<OfflineBanner />));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a warning while offline', async () => {
    mockedUseIsOffline.mockReturnValue(true);
    await render(withSafeArea(<OfflineBanner />));

    expect(
      screen.getByText(/You.re offline. Some things won.t work until you.re back online\./),
    ).toBeTruthy();
  });
});
