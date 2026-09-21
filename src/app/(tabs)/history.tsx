import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { EmptyState } from '@/components/EmptyState';
import { children, getCurrentWeek, getWeekHistory } from '@/lib/mockData';
import { calculateEarnedCents, calculateMaximumCents, formatCurrency } from '@/lib/money';
import { colors, minTouchTarget, spacing, typography } from '@/lib/theme';

// History shows only "what happened that week" — no graphs, no scores
// (master spec section 25).
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [selectedChildId, setSelectedChildId] = useState(children[0].id);
  const weeks = getWeekHistory(selectedChildId);

  const childSwitcherItems = children.map((child) => {
    const current = getCurrentWeek(child.id);
    return {
      id: child.id,
      name: child.name,
      earnedCents: calculateEarnedCents(current.occurrences),
      maximumCents: calculateMaximumCents(current.occurrences),
    };
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={typography.screenTitle}>History</Text>

      <ChildSwitcher
        items={childSwitcherItems}
        selectedId={selectedChildId}
        onSelect={setSelectedChildId}
      />

      {weeks.length === 0 ? (
        <EmptyState message="No previous weeks yet." />
      ) : (
        <View style={styles.list}>
          {weeks.map((week) => (
            <Pressable
              key={week.id}
              onPress={() => router.push(`/history/${week.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Week of ${week.weekStart}, ${formatCurrency(week.earnedCents)} of ${formatCurrency(week.maximumCents)}, ${week.paymentStatus === 'paid' ? 'paid' : 'not paid'}`}
            >
              <Card style={styles.weekCard}>
                <View style={styles.weekInfo}>
                  <Text style={typography.taskName}>Week of {week.weekStart}</Text>
                  <Text style={typography.secondaryMeta}>
                    {formatCurrency(week.earnedCents)} / {formatCurrency(week.maximumCents)}
                  </Text>
                </View>
                <PaymentBadge paid={week.paymentStatus === 'paid'} />
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function PaymentBadge({ paid }: { paid: boolean }) {
  return (
    <View style={styles.badgeRow}>
      {paid ? <Ionicons name="checkmark-circle" size={16} color={colors.primary} /> : null}
      <Text style={[typography.secondaryMeta, paid && styles.paidLabel]}>
        {paid ? 'Paid' : 'Not paid'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  weekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  weekInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paidLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
});
