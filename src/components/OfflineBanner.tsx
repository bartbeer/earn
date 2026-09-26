import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOffline } from '@/hooks/useIsOffline';
import { spacing } from '@/lib/theme';

/**
 * A persistent bar shown across every screen (rendered once, above the
 * root Stack) whenever the device has no network connection — proactive
 * warning rather than only finding out via a failed save. Renders nothing
 * at all while online, so it never reserves layout space or shows up in
 * accessibility tree scans of a normal, connected session.
 */
export function OfflineBanner() {
  const isOffline = useIsOffline();
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}
      accessibilityRole="alert"
    >
      <Text style={styles.text}>You&rsquo;re offline. Some things won&rsquo;t work until you&rsquo;re back online.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#B3261E',
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
