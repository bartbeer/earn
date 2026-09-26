import { renderHook } from '@testing-library/react-native';

import { useIsOffline } from '@/hooks/useIsOffline';

const mockUseNetworkState = jest.fn();

jest.mock('expo-network', () => ({
  useNetworkState: () => mockUseNetworkState(),
}));

beforeEach(() => {
  mockUseNetworkState.mockReset();
});

// Phase 10: offline detection. Deliberately keyed on isConnected (not
// isInternetReachable) — see the hook's own comment for why.
describe('useIsOffline', () => {
  it('reports online when connected', async () => {
    mockUseNetworkState.mockReturnValue({ isConnected: true });
    const { result } = await renderHook(() => useIsOffline());
    expect(result.current).toBe(false);
  });

  it('reports offline when not connected', async () => {
    mockUseNetworkState.mockReturnValue({ isConnected: false });
    const { result } = await renderHook(() => useIsOffline());
    expect(result.current).toBe(true);
  });

  it('reports online (not offline) while the state is still undetermined', async () => {
    mockUseNetworkState.mockReturnValue({ isConnected: undefined });
    const { result } = await renderHook(() => useIsOffline());
    expect(result.current).toBe(false);
  });
});
