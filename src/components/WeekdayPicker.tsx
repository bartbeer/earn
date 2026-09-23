import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minTouchTarget, radii, spacing, typography } from '@/lib/theme';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // 0 = Sunday .. 6 = Saturday
const DAY_ACCESSIBILITY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface WeekdayPickerProps {
  selectedDays: number[];
  onChange: (days: number[]) => void;
}

/** Seven toggleable day chips (Sun..Sat) for once_weekly/selected_days chore schedules. */
export function WeekdayPicker({ selectedDays, onChange }: WeekdayPickerProps) {
  function toggleDay(day: number) {
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter((d) => d !== day));
    } else {
      onChange([...selectedDays, day].sort((a, b) => a - b));
    }
  }

  return (
    <View style={styles.row}>
      {DAY_LABELS.map((label, day) => {
        const selected = selectedDays.includes(day);
        return (
          <Pressable
            key={day}
            onPress={() => toggleDay(day)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={DAY_ACCESSIBILITY_NAMES[day]}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[typography.taskName, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    flex: 1,
    minHeight: minTouchTarget,
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
  labelSelected: {
    color: colors.surface,
  },
});
