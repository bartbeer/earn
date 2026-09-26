import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { fetchChores } from '@/lib/api/chores';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatReward } from '@/lib/money';
import { describeSchedule } from '@/lib/schedule';
import { colors, minTouchTarget, spacing, typography } from '@/lib/theme';
import type { Chore, RewardType } from '@/types/domain';

// Parent-only chore management (master spec section 28). Reachable from
// Settings > Chores > Manage chores.
export default function ManageChoresScreen() {
  const { appState } = useAuth();
  const familyId = appState.status === 'active' ? appState.membership.familyId : '';

  const { children } = useFamilyChildren(familyId);
  const [chores, setChores] = useState<Chore[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // useFocusEffect (not a plain useEffect) so returning from add-chore /
  // edit-chore shows the change immediately — deactivating a chore, for
  // instance, should drop it from this list without needing a full remount.
  useFocusEffect(
    useCallback(() => {
      if (!familyId) return;
      let isMounted = true;
      fetchChores(familyId).then((result) => {
        if (isMounted) {
          setChores(result);
          setIsLoading(false);
        }
      });
      return () => {
        isMounted = false;
      };
    }, [familyId]),
  );

  const childNameById = Object.fromEntries(children.map((child) => [child.id, child.name]));
  const childRewardTypeById: Record<string, RewardType> = Object.fromEntries(
    children.map((child) => [child.id, child.rewardType]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {isLoading ? null : chores.length === 0 ? (
        <EmptyState message="No chores yet." />
      ) : (
        <View style={styles.list}>
          {chores.map((chore) => {
            const amountLabel = formatReward(
              chore.amountCents,
              childRewardTypeById[chore.childId] ?? 'currency',
            );
            return (
              <Pressable
                key={chore.id}
                onPress={() => router.push(`/edit-chore/${chore.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${chore.name}, ${childNameById[chore.childId] ?? ''}, ${describeSchedule(chore.recurrenceType, chore.scheduleDays)}, ${amountLabel}`}
              >
                <Card style={styles.choreCard}>
                  <View style={styles.choreInfo}>
                    <Text style={typography.taskName}>{chore.name}</Text>
                    <Text style={typography.secondaryMeta}>
                      {childNameById[chore.childId] ?? ''} ·{' '}
                      {describeSchedule(chore.recurrenceType, chore.scheduleDays)}
                    </Text>
                  </View>
                  <Text style={typography.taskAmount}>{amountLabel}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <Button label="Add chore" onPress={() => router.push('/add-chore')} />
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
    gap: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  choreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  choreInfo: {
    flex: 1,
    gap: spacing.xs,
  },
});
