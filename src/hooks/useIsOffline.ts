import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Whether the device currently has no active network connection at all.
 *
 * Not expo-network's useNetworkState(): reported by hand-testing, it
 * reliably detected *going* offline but not *coming back* online — the
 * banner stayed up until the app was fully reloaded. NetInfo's
 * addEventListener subscription is the long-established mechanism for
 * exactly this ("tell me live, in both directions"), so it's used
 * directly here rather than via any wrapper hook.
 *
 * Deliberately keyed on isConnected, not isInternetReachable: iOS never
 * reports the two differently anyway, and Android's isInternetReachable
 * can flap for a merely slow/flaky connection in a way that would make
 * the offline banner flicker rather than reflect a genuinely absent
 * network — a real distinction not worth chasing for this app's scale.
 */
export function useIsOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let isMounted = true;

    NetInfo.fetch().then((state) => {
      if (isMounted) setIsOffline(state.isConnected === false);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (isMounted) setIsOffline(state.isConnected === false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return isOffline;
}
