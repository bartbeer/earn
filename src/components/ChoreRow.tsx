import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Checkbox } from '@/components/Checkbox';
import { formatCurrency } from '@/lib/money';
import { colors, minTouchTarget, spacing, typography } from '@/lib/theme';

interface ChoreRowProps {
  name: string;
  amountCents: number;
  completed: boolean;
  onToggle: () => void;
  /** True while this occurrence's toggle is already in flight (double-tap protection). */
  disabled?: boolean;
}

/**
 * The core row of the app: checkbox + chore name + amount. The whole row is
 * tappable (not just the checkbox) so it's an easy target for young children
 * (master spec sections 13, 31).
 */
export function ChoreRow({ name, amountCents, completed, onToggle, disabled }: ChoreRowProps) {
  const label = `${name}, ${formatCurrency(amountCents)}, ${completed ? 'completed' : 'not completed'}`;

  return (
    // accessible={false}: the inner Checkbox already exposes the full
    // checkbox role/label/state. Without this, a screen reader would land on
    // two identical "checkbox, name, amount" stops for the same row.
    <Pressable onPress={onToggle} disabled={disabled} accessible={false} style={styles.row}>
      <Checkbox
        checked={completed}
        onToggle={onToggle}
        accessibilityLabel={label}
        disabled={disabled}
      />
      <View style={styles.textGroup}>
        <Text style={[typography.taskName, completed && styles.completedText]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={[typography.taskAmount, completed && styles.completedAmount]}>
        {formatCurrency(amountCents)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchTarget,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  textGroup: {
    flex: 1,
  },
  completedText: {
    color: colors.textMuted,
  },
  completedAmount: {
    color: colors.textMuted,
  },
});
