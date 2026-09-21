import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '@/lib/theme';

interface EmptyStateProps {
  message: string;
}

/** A plain, calm empty state — no illustration needed (master spec section 88). */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={typography.secondaryMeta}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
});
