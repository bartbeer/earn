import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ChildSwitcher, type ChildSwitcherItem } from '@/components/ChildSwitcher';
import { ChoreRow } from '@/components/ChoreRow';
import { EmptyState } from '@/components/EmptyState';
import { ProgressBar } from '@/components/ProgressBar';
import { ChoreListSkeleton } from '@/components/Skeleton';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isOccurrenceToday, toISODate } from '@/lib/date';
import { fetchCurrentWeek, setOccurrenceCompletion } from '@/lib/api/weeks';
import { calculateEarnedCents, formatCurrency } from '@/lib/money';
import { colors, spacing, typography } from '@/lib/theme';
import type { ChoreOccurrence, WeekSummary } from '@/types/domain';

export default function WeekScreen() {
  const { appState } = useAuth();
  const insets = useSafeAreaInsets();

  // Every hook below must run unconditionally on every render (React's
  // rules of hooks) — so the 'active' membership is read into safe
  // fallbacks here, and the actual bail-out for a non-active appState
  // happens after all hooks, in the JSX below. In practice this screen is
  // never mounted for a non-active appState anyway (see _layout.tsx's
  // Stack.Protected), so the fallbacks are never visibly exercised.
  const membership = appState.status === 'active' ? appState.membership : null;
  const familyId = membership?.familyId ?? '';
  const isParent = membership?.role === 'parent';

  const { children } = useFamilyChildren(familyId);

  // Derived, not stored+synced via an effect: the default is "the first
  // child" for a parent or "yourself" for a child, unless the user has
  // explicitly picked someone else in the switcher. The explicit pick is
  // only honoured while it's still a real, active child — otherwise (e.g.
  // the parent had NewKid selected and then removed NewKid) this falls
  // back to the default instead of staying stuck showing a removed
  // child's stale data with no name to show for it in the switcher.
  const [explicitChildId, setExplicitChildId] = useState<string | null>(null);
  const defaultChildId = isParent ? (children[0]?.id ?? null) : (membership?.childId ?? null);
  const explicitChildStillValid =
    explicitChildId !== null && children.some((child) => child.id === explicitChildId);
  const selectedChildId = explicitChildStillValid ? explicitChildId : defaultChildId;

  const [switcherSummaries, setSwitcherSummaries] = useState<ChildSwitcherItem[]>([]);
  useEffect(() => {
    if (!isParent || children.length <= 1) return;
    let isMounted = true;
    Promise.allSettled(
      children.map(async (child) => {
        const week = await fetchCurrentWeek(child.id, familyId);
        return {
          id: child.id,
          name: child.name,
          earnedCents: week?.earnedCents ?? 0,
          maximumCents: week?.maximumCents ?? 0,
        };
      }),
    ).then((results) => {
      if (!isMounted) return;
      // allSettled, not all: one child's fetch failing (e.g. a removal
      // mid-flight) shouldn't blank out everyone else's chip.
      const summaries = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      setSwitcherSummaries(summaries);
    });
    return () => {
      isMounted = false;
    };
  }, [isParent, children, familyId]);

  // switcherSummaries is populated by its own async fetch (above), which is
  // slower than the children list itself — so a just-removed child can
  // briefly still be sitting in switcherSummaries after `children` (and
  // therefore selectedChildId) has already moved on without them. Filtering
  // here, synchronously at render time, means the switcher never shows a
  // dangling, tappable chip for a child who no longer exists, regardless of
  // whether the slower summaries refetch has caught up yet.
  const visibleSwitcherSummaries = switcherSummaries.filter((summary) =>
    children.some((child) => child.id === summary.id),
  );

  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [isLoadingWeek, setIsLoadingWeek] = useState(true);
  // useFocusEffect (not a plain useEffect) so returning from add-chore /
  // edit-chore / manage-chores re-triggers generation and picks up the
  // change immediately, rather than only refreshing on selectedChildId
  // changing or a full remount.
  useFocusEffect(
    useCallback(() => {
      // No child to load for yet (e.g. a parent whose children are still
      // loading, or one with none at all — handled by the empty state
      // below). isLoadingWeek is only ever read while a child IS selected,
      // so leaving it untouched here is harmless.
      if (!selectedChildId) return;

      let isMounted = true;
      setIsLoadingWeek(true);
      fetchCurrentWeek(selectedChildId, familyId).then((result) => {
        if (isMounted) {
          setWeek(result);
          setIsLoadingWeek(false);
        }
      });
      return () => {
        isMounted = false;
      };
    }, [selectedChildId, familyId]),
  );

  // Which occurrences currently have a completion request in flight —
  // their checkboxes are disabled meanwhile (double-tap protection at the
  // UI layer, on top of the RPC being safe to call twice regardless).
  const [pendingToggleIds, setPendingToggleIds] = useState<Set<string>>(new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);

  function applyOccurrenceUpdate(
    current: WeekSummary | null,
    occurrenceId: string,
    updater: (occurrence: ChoreOccurrence) => ChoreOccurrence,
  ): WeekSummary | null {
    if (!current) return current;
    const occurrences = current.occurrences.map((occurrence) =>
      occurrence.id === occurrenceId ? updater(occurrence) : occurrence,
    );
    return { ...current, occurrences, earnedCents: calculateEarnedCents(occurrences) };
  }

  // Checkbox toggling feels instant (section 15): the UI updates
  // optimistically before the network round-trip resolves, then
  // reconciles with (or rolls back to match) whatever the database — the
  // real source of truth (section 50) — actually ends up saying.
  function toggleOccurrence(occurrenceId: string) {
    if (pendingToggleIds.has(occurrenceId)) return;

    const target = week?.occurrences.find((o) => o.id === occurrenceId);
    if (!target) return;
    const nextCompleted = target.status !== 'completed';

    setToggleError(null);
    setWeek((current) =>
      applyOccurrenceUpdate(current, occurrenceId, (o) => ({
        ...o,
        status: nextCompleted ? 'completed' : 'pending',
      })),
    );
    setPendingToggleIds((current) => new Set(current).add(occurrenceId));

    setOccurrenceCompletion(occurrenceId, nextCompleted)
      .then((updated) => {
        setWeek((current) => applyOccurrenceUpdate(current, occurrenceId, () => updated));
      })
      .catch(() => {
        setWeek((current) =>
          applyOccurrenceUpdate(current, occurrenceId, (o) => ({
            ...o,
            status: nextCompleted ? 'pending' : 'completed',
          })),
        );
        setToggleError("Couldn't save that. Try again.");
      })
      .finally(() => {
        setPendingToggleIds((current) => {
          const next = new Set(current);
          next.delete(occurrenceId);
          return next;
        });
      });
  }

  if (!membership) return null;

  if (isParent && children.length === 0) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Text style={typography.screenTitle}>Add your first child</Text>
        <Button label="Add child" onPress={() => router.push('/add-child')} />
      </View>
    );
  }

  const todayISO = toISODate(new Date());
  const sections = week ? groupOccurrencesByStatus(week.occurrences, todayISO) : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={typography.sectionLabel}>This week</Text>

      {isParent && children.length > 1 && selectedChildId ? (
        <ChildSwitcher
          items={visibleSwitcherSummaries}
          selectedId={selectedChildId}
          onSelect={setExplicitChildId}
        />
      ) : null}

      <View style={styles.earnedBlock}>
        <Text style={typography.secondaryMeta}>Earned</Text>
        <Text style={typography.primaryNumber}>
          {formatCurrency(week?.earnedCents ?? 0)}{' '}
          <Text style={styles.maximum}>/ {formatCurrency(week?.maximumCents ?? 0)}</Text>
        </Text>
        <ProgressBar
          progress={!week || week.maximumCents === 0 ? 0 : week.earnedCents / week.maximumCents}
        />
      </View>

      {toggleError ? <Text style={styles.error}>{toggleError}</Text> : null}

      {isLoadingWeek ? (
        <ChoreListSkeleton />
      ) : !week || week.occurrences.length === 0 ? (
        <EmptyState message="Nothing planned yet." />
      ) : (
        sections && (
          <>
            <ChoreSection
              title="Today"
              occurrences={sections.today}
              onToggle={toggleOccurrence}
              pendingIds={pendingToggleIds}
            />
            <ChoreSection
              title="Later this week"
              occurrences={sections.later}
              onToggle={toggleOccurrence}
              pendingIds={pendingToggleIds}
            />
            <ChoreSection
              title="Completed"
              occurrences={sections.completed}
              onToggle={toggleOccurrence}
              pendingIds={pendingToggleIds}
            />
          </>
        )
      )}
    </ScrollView>
  );
}

function groupOccurrencesByStatus(occurrences: ChoreOccurrence[], todayISO: string) {
  const today: ChoreOccurrence[] = [];
  const later: ChoreOccurrence[] = [];
  const completed: ChoreOccurrence[] = [];

  for (const occurrence of occurrences) {
    if (occurrence.status === 'completed') {
      completed.push(occurrence);
    } else if (
      isOccurrenceToday(occurrence.scheduledDate, todayISO) ||
      occurrence.scheduledDate < todayISO
    ) {
      today.push(occurrence);
    } else {
      later.push(occurrence);
    }
  }

  return { today, later, completed };
}

interface ChoreSectionProps {
  title: string;
  occurrences: ChoreOccurrence[];
  onToggle: (occurrenceId: string) => void;
  pendingIds: Set<string>;
}

function ChoreSection({ title, occurrences, onToggle, pendingIds }: ChoreSectionProps) {
  if (occurrences.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={typography.sectionLabel}>{title}</Text>
      {occurrences.map((occurrence) => (
        <ChoreRow
          key={occurrence.id}
          name={occurrence.name}
          amountCents={occurrence.amountCents}
          completed={occurrence.status === 'completed'}
          onToggle={() => onToggle(occurrence.id)}
          disabled={pendingIds.has(occurrence.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  earnedBlock: {
    gap: spacing.sm,
  },
  maximum: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.xs,
  },
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
});
