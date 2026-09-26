import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useIsOffline } from '@/hooks/useIsOffline';

const mockFetch = jest.fn();
const mockAddEventListener = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args: unknown[]) => mockFetch(...args),
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  },
}));

beforeEach(() => {
  mockFetch.mockReset();
  mockAddEventListener.mockReset().mockReturnValue(mockUnsubscribe);
  mockUnsubscribe.mockReset();
});

// Phase 10: offline detection. Reported by hand-testing: the original
// implementation (expo-network's useNetworkState) detected going offline
// but never noticed coming back online without a full app reload — these
// tests specifically cover both directions via NetInfo's live listener,
// not just the initial fetch.
describe('useIsOffline', () => {
  it('reports online once the initial fetch resolves connected', async () => {
    mockFetch.mockResolvedValue({ isConnected: true });
    const { result } = await renderHook(() => useIsOffline());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('reports offline once the initial fetch resolves disconnected', async () => {
    mockFetch.mockResolvedValue({ isConnected: false });
    const { result } = await renderHook(() => useIsOffline());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('defaults to online before the initial fetch resolves', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = await renderHook(() => useIsOffline());
    expect(result.current).toBe(false);
  });

  it('updates live when the listener reports going offline', async () => {
    mockFetch.mockResolvedValue({ isConnected: true });
    const { result } = await renderHook(() => useIsOffline());
    await waitFor(() => expect(result.current).toBe(false));

    const listener = mockAddEventListener.mock.calls[0][0];
    await act(async () => {
      listener({ isConnected: false });
    });

    expect(result.current).toBe(true);
  });

  // The exact regression: going offline was detected, but coming back
  // online was not, until the app was fully reloaded.
  it('updates live when the listener reports coming back online', async () => {
    mockFetch.mockResolvedValue({ isConnected: false });
    const { result } = await renderHook(() => useIsOffline());
    await waitFor(() => expect(result.current).toBe(true));

    const listener = mockAddEventListener.mock.calls[0][0];
    await act(async () => {
      listener({ isConnected: true });
    });

    expect(result.current).toBe(false);
  });

  it('unsubscribes from the listener on unmount', async () => {
    mockFetch.mockResolvedValue({ isConnected: true });
    const { unmount } = await renderHook(() => useIsOffline());
    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());

    await unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
