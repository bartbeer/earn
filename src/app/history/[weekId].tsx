import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoreRow } from '@/components/ChoreRow';
import { useIsOffline } from '@/hooks/useIsOffline';
import { fetchWeekById, setWeekPaymentStatus } from '@/lib/api/weeks';
import { describeFailure } from '@/lib/errorMessages';
import { formatReward } from '@/lib/money';
import { colors, spacing, typography } from '@/lib/theme';
import type { WeekSummary } from '@/types/domain';

export default function WeekDetailScreen() {
  const { weekId } = useLocalSearchParams<{ weekId: string }>();
  const isOffline = useIsOffline();
  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchWeekById(weekId).then((result) => {
      if (!isMounted) return;
      setWeek(result);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [weekId]);

  // Same optimistic-then-reconcile pattern as the Week screen's checkbox
  // toggle: the button flips immediately, then settles on whatever the
  // server actually snapshotted (section 24) once the request resolves, or
  // rolls back on failure.
  function handleTogglePayment() {
    if (!week || isSavingPayment) return;
    const previous = week;
    const nextPaid = week.paymentStatus !== 'paid';

    setPaymentError(null);
    setWeek({
      ...week,
      paymentStatus: nextPaid ? 'paid' : 'not_paid',
      paidAmountCents: nextPaid ? week.earnedCents : null,
    });
    setIsSavingPayment(true);

    setWeekPaymentStatus(week.id, nextPaid)
      .then((updated) => {
        setWeek((current) =>
          current
            ? {
                ...current,
                paymentStatus: updated.paymentStatus,
                paidAmountCents: updated.paidAmountCents,
              }
            : current,
        );
      })
      .catch(() => {
        setWeek(previous);
        setPaymentError(describeFailure(isOffline));
      })
      .finally(() => {
        setIsSavingPayment(false);
      });
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!week) {
    return (
      <View style={styles.centered}>
        <Text style={typography.body}>Week not found.</Text>
      </View>
    );
  }

  const isPaid = week.paymentStatus === 'paid';
  const isStars = week.childRewardType === 'stars';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.sectionLabel}>
        Week of {week.weekStart} – {week.weekEnd}
      </Text>

      {/* Read-only: correcting a past week's individual completions isn't
          part of this screen — set_occurrence_completion also refuses to
          touch a paid week's occurrences once payment is marked. */}
      <Card style={styles.list}>
        {week.occurrences.map((occurrence) => (
          <ChoreRow
            key={occurrence.id}
            name={occurrence.name}
            amountCents={occurrence.amountCents}
            rewardType={week.childRewardType}
            completed={occurrence.status === 'completed'}
            onToggle={() => {}}
          />
        ))}
      </Card>

      <View style={styles.earnedBlock}>
        <Text style={typography.secondaryMeta}>Earned</Text>
        <Text style={typography.primaryNumber}>
          {formatReward(week.earnedCents, week.childRewardType)}{' '}
          <Text style={styles.maximum}>/ {formatReward(week.maximumCents, week.childRewardType)}</Text>
        </Text>
      </View>

      {paymentError ? <Text style={styles.error}>{paymentError}</Text> : null}

      {/* "Paid" implies real money, which doesn't fit stars — a
          non-monetary reward is "given", not "paid" (see also the History
          list screen's identically-reasoned PaymentBadge). */}
      {isPaid ? (
        <Button
          label={isSavingPayment ? 'Saving…' : isStars ? 'Given ✓' : 'Paid ✓'}
          variant="secondary"
          onPress={handleTogglePayment}
          disabled={isSavingPayment}
        />
      ) : (
        <Button
          label={isSavingPayment ? 'Saving…' : isStars ? 'Mark as given' : 'Mark as paid'}
          onPress={handleTogglePayment}
          disabled={isSavingPayment}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  list: {
    gap: spacing.xs,
  },
  earnedBlock: {
    gap: spacing.sm,
  },
  maximum: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
});
