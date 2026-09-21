import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

/** A single gray placeholder bar. */
function SkeletonBar({ width }: { width: `${number}%` }) {
  return <View style={[styles.bar, { width }]} />;
}

/** A simple loading placeholder shaped like a handful of chore rows. */
export function ChoreListSkeleton() {
  return (
    <View accessibilityLabel="Loading" style={styles.container}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.row}>
          <View style={styles.checkboxPlaceholder} />
          <SkeletonBar width="60%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkboxPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.track,
  },
  bar: {
    height: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.track,
  },
});
