import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoreRow } from '@/components/ChoreRow';
import { fetchWeekById } from '@/lib/api/weeks';
import { formatReward } from '@/lib/money';
import { colors, spacing, typography } from '@/lib/theme';
import type { PaymentStatus, WeekSummary } from '@/types/domain';

// Mark as paid / undo paid is UI-only in Phase 1-3 — it resets on remount.
// Phase 8 wires this to a real backend write with a paid-amount snapshot
// (master spec section 24: the snapshot must never change after the fact).
export default function WeekDetailScreen() {
  const { weekId } = useLocalSearchParams<{ weekId: string }>();
  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('not_paid');

  useEffect(() => {
    let isMounted = true;
    fetchWeekById(weekId).then((result) => {
      if (!isMounted) return;
      setWeek(result);
      if (result) setPaymentStatus(result.paymentStatus);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [weekId]);

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

  const isPaid = paymentStatus === 'paid';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.sectionLabel}>
        Week of {week.weekStart} – {week.weekEnd}
      </Text>

      {/* Read-only here: correcting a past week's completion is a parent
          action wired up once Phase 6/8 add the real backend + closed-week
          rules (master spec sections 16, 48). */}
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

      {/* "Paid" implies real money, which doesn't fit stars — a
          non-monetary reward is "given", not "paid" (see also the History
          list screen's identically-reasoned PaymentBadge). */}
      {isPaid ? (
        <Button
          label={week.childRewardType === 'stars' ? 'Given ✓' : 'Paid ✓'}
          variant="secondary"
          onPress={() => setPaymentStatus('not_paid')}
        />
      ) : (
        <Button
          label={week.childRewardType === 'stars' ? 'Mark as given' : 'Mark as paid'}
          onPress={() => setPaymentStatus('paid')}
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
});
