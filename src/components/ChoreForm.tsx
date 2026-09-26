import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { WeekdayPicker } from '@/components/WeekdayPicker';
import { useIsOffline } from '@/hooks/useIsOffline';
import { describeFailure } from '@/lib/errorMessages';
import { isValidRewardAmount, MAX_STARS_AMOUNT, parseRewardAmount } from '@/lib/money';
import { validateSchedule } from '@/lib/schedule';
import { spacing, typography } from '@/lib/theme';
import type { Child, RecurrenceType, RewardType } from '@/types/domain';

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
  // No silent default when there's a real choice to make: pre-selecting
  // childOptions[0] meant a parent who added a chore without noticing (or
  // tapping) the child chip got it silently assigned to whoever happened to
  // sort first alphabetically — a real reported bug where a chore assigned
  // this way kept showing up for that other child no matter how many times
  // the app was reloaded, since it never belonged to the intended child at
  // all. With only one child there's no ambiguity to force a choice about.
  const [childId, setChildId] = useState(
    initialValues?.childId ?? (childOptions.length === 1 ? childOptions[0].id : ''),
  );
  // A chore's child is only ever chosen at creation — updateChore() never
  // sends childId, so editing never actually reassigns it. Not offering the
  // picker here (rather than showing inert chips) avoids the confusing
  // combination of "tap a different child" with "nothing happens, but the
  // amount field's unit below silently relabels itself as if it had".
  const isEditing = initialValues?.childId !== undefined;
  const rewardType: RewardType =
    childOptions.find((child) => child.id === childId)?.rewardType ?? 'currency';

  const [amountText, setAmountText] = useState(() => {
    if (initialValues?.amountCents === undefined) return '';
    return rewardType === 'stars'
      ? String(initialValues.amountCents)
      : (initialValues.amountCents / 100).toFixed(2);
  });
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    initialValues?.recurrenceType ?? 'once_weekly',
  );
  const [scheduleDays, setScheduleDays] = useState<number[]>(initialValues?.scheduleDays ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOffline = useIsOffline();

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

    const amountCents = parseRewardAmount(amountText, rewardType);
    if (amountCents === null || !isValidRewardAmount(amountCents, rewardType)) {
      setError(
        rewardType === 'stars'
          ? `Enter a valid whole number of stars, up to ${MAX_STARS_AMOUNT}.`
          : 'Enter a valid amount, up to €1,000.',
      );
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
      setError(describeFailure(isOffline, "Couldn't save that chore. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField label="Chore name" value={name} onChangeText={setName} autoFocus />

      {!isEditing && childOptions.length > 1 ? (
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
        label={rewardType === 'stars' ? 'Amount per completion (stars)' : 'Amount per completion (€)'}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType={rewardType === 'stars' ? 'number-pad' : 'decimal-pad'}
        placeholder={rewardType === 'stars' ? '0' : '0.00'}
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
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
});
