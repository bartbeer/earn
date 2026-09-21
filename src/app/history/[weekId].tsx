import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoreRow } from '@/components/ChoreRow';
import { getWeekById } from '@/lib/mockData';
import { formatCurrency } from '@/lib/money';
import { colors, spacing, typography } from '@/lib/theme';
import type { PaymentStatus } from '@/types/domain';

// Mark as paid / undo paid is UI-only in Phase 1 — it resets on remount.
// Phase 8 wires this to a real backend write with a paid-amount snapshot
// (master spec section 24: the snapshot must never change after the fact).
export default function WeekDetailScreen() {
  const { weekId } = useLocalSearchParams<{ weekId: string }>();
  const week = getWeekById(weekId);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    week?.paymentStatus ?? 'not_paid',
  );

  if (!week) {
    return (
      <View style={styles.screen}>
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
            completed={occurrence.status === 'completed'}
            onToggle={() => {}}
          />
        ))}
      </Card>

      <View style={styles.earnedBlock}>
        <Text style={typography.secondaryMeta}>Earned</Text>
        <Text style={typography.primaryNumber}>
          {formatCurrency(week.earnedCents)}{' '}
          <Text style={styles.maximum}>/ {formatCurrency(week.maximumCents)}</Text>
        </Text>
      </View>

      {isPaid ? (
        <Button label="Paid ✓" variant="secondary" onPress={() => setPaymentStatus('not_paid')} />
      ) : (
        <Button label="Mark as paid" onPress={() => setPaymentStatus('paid')} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
