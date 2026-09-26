import * as Network from 'expo-network';

/**
 * Whether the device currently has no active network connection at all.
 * Deliberately keyed on isConnected, not isInternetReachable: iOS never
 * reports the two differently anyway, and Android's isInternetReachable
 * can flap for a merely slow/flaky connection in a way that would make
 * the offline banner flicker rather than reflect a genuinely absent
 * network — a real distinction not worth chasing for this app's scale.
 * Undefined (not yet determined) reads as online rather than flashing an
 * offline banner before the first check resolves.
 */
export function useIsOffline(): boolean {
  const state = Network.useNetworkState();
  return state.isConnected === false;
}
