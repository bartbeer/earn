import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { WeekdayPicker } from '@/components/WeekdayPicker';
import { isValidChoreAmountCents, parseEuroAmountToCents } from '@/lib/money';
import { validateSchedule } from '@/lib/schedule';
import { colors, minTouchTarget, radii, spacing, typography } from '@/lib/theme';
import type { Child, RecurrenceType } from '@/types/domain';

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'once_weekly', label: 'Weekly' },
  { value: 'selected_days', label: 'Selected days' },
  { value: 'daily', label: 'Daily' },
];

export interface ChoreFormValues {
  name: string;
  childId: string;
  amountCents: number;
  recurrenceType: RecurrenceType;
  scheduleDays: number[];
}

interface ChoreFormProps {
  childOptions: Child[];
  initialValues?: Partial<ChoreFormValues>;
  submitLabel: string;
  onSubmit: (values: ChoreFormValues) => Promise<void>;
  extraAction?: { label: string; onPress: () => void };
}

/** The chore create/edit form (master spec section 28): name, child, amount, schedule. */
export function ChoreForm({
  childOptions,
  initialValues,
  submitLabel,
  onSubmit,
  extraAction,
}: ChoreFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [childId, setChildId] = useState(initialValues?.childId ?? childOptions[0]?.id ?? '');
  const [amountText, setAmountText] = useState(
    initialValues?.amountCents !== undefined ? (initialValues.amountCents / 100).toFixed(2) : '',
  );
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    initialValues?.recurrenceType ?? 'once_weekly',
  );
  const [scheduleDays, setScheduleDays] = useState<number[]>(initialValues?.scheduleDays ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleRecurrenceChange(next: RecurrenceType) {
    setRecurrenceType(next);
    // A once_weekly chore only ever has one day — dropping any extra
    // selection avoids silently keeping stale days from a previous choice.
    if (next === 'once_weekly' && scheduleDays.length > 1) {
      setScheduleDays(scheduleDays.slice(0, 1));
    }
  }

  async function handleSubmit() {
    setError(null);

    const amountCents = parseEuroAmountToCents(amountText);
    if (amountCents === null || !isValidChoreAmountCents(amountCents)) {
      setError('Enter a valid amount, up to €1,000.');
      return;
    }
    if (!childId) {
      setError('Choose a child.');
      return;
    }
    const scheduleValidation = validateSchedule(recurrenceType, scheduleDays);
    if (!scheduleValidation.valid) {
      setError(scheduleValidation.reason);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), childId, amountCents, recurrenceType, scheduleDays });
    } catch {
      setError("Couldn't save that chore. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField label="Chore name" value={name} onChangeText={setName} autoFocus />

      {childOptions.length > 1 ? (
        <View style={styles.field}>
          <Text style={typography.secondaryMeta}>Child</Text>
          <View style={styles.chipRow}>
            {childOptions.map((child) => (
              <Chip
                key={child.id}
                label={child.name}
                selected={child.id === childId}
                onPress={() => setChildId(child.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <TextField
        label="Amount per completion (€)"
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />

      <View style={styles.field}>
        <Text style={typography.secondaryMeta}>Schedule</Text>
        <View style={styles.chipRow}>
          {RECURRENCE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={option.value === recurrenceType}
              onPress={() => handleRecurrenceChange(option.value)}
            />
          ))}
        </View>
      </View>

      {recurrenceType !== 'daily' ? (
        <WeekdayPicker selectedDays={scheduleDays} onChange={setScheduleDays} />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={isSubmitting ? 'Saving…' : submitLabel}
        onPress={handleSubmit}
        disabled={isSubmitting || !name.trim()}
      />

      {extraAction ? (
        <Button label={extraAction.label} variant="secondary" onPress={extraAction.onPress} />
      ) : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
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
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
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
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
});
