import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { formatCurrency } from '@/lib/money';
import { colors, minTouchTarget, radii, spacing, typography } from '@/lib/theme';

export interface ChildSwitcherItem {
  id: string;
  name: string;
  earnedCents: number;
  maximumCents: number;
}

interface ChildSwitcherProps {
  items: ChildSwitcherItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Lets a parent quickly jump between children's current weeks (master spec section 26). */
export function ChildSwitcher({ items, selectedId, onSelect }: ChildSwitcherProps) {
  if (items.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((child) => {
        const selected = child.id === selectedId;
        return (
          <Pressable
            key={child.id}
            onPress={() => onSelect(child.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.name, selected && styles.nameSelected]}>{child.name}</Text>
            <Text style={[styles.amount, selected && styles.nameSelected]}>
              {formatCurrency(child.earnedCents)} / {formatCurrency(child.maximumCents)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chip: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  name: {
    ...typography.taskName,
    fontWeight: '600',
  },
  amount: {
    ...typography.secondaryMeta,
  },
  nameSelected: {
    color: colors.surface,
  },
});
