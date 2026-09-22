import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { ChildSwitcher, type ChildSwitcherItem } from '@/components/ChildSwitcher';
import { EmptyState } from '@/components/EmptyState';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fetchCurrentWeek, fetchWeekHistory } from '@/lib/api/weeks';
import { formatCurrency } from '@/lib/money';
import { colors, minTouchTarget, spacing, typography } from '@/lib/theme';
import type { WeekSummary } from '@/types/domain';

// History shows only "what happened that week" — no graphs, no scores
// (master spec section 25).
export default function HistoryScreen() {
  const { appState } = useAuth();
  const insets = useSafeAreaInsets();

  // See index.tsx for why the membership-derived values use fallbacks
  // instead of an early return here: every hook must run unconditionally.
  const membership = appState.status === 'active' ? appState.membership : null;
  const familyId = membership?.familyId ?? '';
  const isParent = membership?.role === 'parent';

  const { children } = useFamilyChildren(familyId);

  const [explicitChildId, setExplicitChildId] = useState<string | null>(null);
  const defaultChildId = isParent ? (children[0]?.id ?? null) : (membership?.childId ?? null);
  const selectedChildId = explicitChildId ?? defaultChildId;

  const [switcherSummaries, setSwitcherSummaries] = useState<ChildSwitcherItem[]>([]);
  useEffect(() => {
    if (!isParent || children.length <= 1) return;
    let isMounted = true;
    Promise.all(
      children.map(async (child) => {
        const week = await fetchCurrentWeek(child.id);
        return {
          id: child.id,
          name: child.name,
          earnedCents: week?.earnedCents ?? 0,
          maximumCents: week?.maximumCents ?? 0,
        };
      }),
    ).then((summaries) => {
      if (isMounted) setSwitcherSummaries(summaries);
    });
    return () => {
      isMounted = false;
    };
  }, [isParent, children]);

  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    // No child selected yet — see index.tsx's identical effect for why this
    // is safe to leave isLoading untouched here.
    if (!selectedChildId) return;

    let isMounted = true;
    // Intentional: re-showing loading when selectedChildId changes
    // (switching children) is the desired behaviour, not an accidental
    // cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    fetchWeekHistory(selectedChildId).then((result) => {
      if (isMounted) {
        setWeeks(result);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedChildId]);

  if (!membership) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={typography.screenTitle}>History</Text>

      {isParent && children.length > 1 && selectedChildId ? (
        <ChildSwitcher
          items={switcherSummaries}
          selectedId={selectedChildId}
          onSelect={setExplicitChildId}
        />
      ) : null}

      {isLoading ? null : weeks.length === 0 ? (
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
