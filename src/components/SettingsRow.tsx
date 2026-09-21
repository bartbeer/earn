import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minTouchTarget, spacing, typography } from '@/lib/theme';

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
}

/** A single tappable settings line: label, optional current value, chevron. */
export function SettingsRow({ label, value, onPress }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={styles.row}
    >
      <Text style={typography.body}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={typography.secondaryMeta}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: minTouchTarget,
    gap: spacing.sm,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
