import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, minTouchTarget, radii, spacing, typography } from '@/lib/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** A single-choice pill button, used wherever a form offers a small set of mutually exclusive options (child, schedule, reward type). */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[typography.taskName, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabelSelected: {
    color: colors.surface,
  },
});
