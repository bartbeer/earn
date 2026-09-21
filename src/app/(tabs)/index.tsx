import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ChoreRow } from '@/components/ChoreRow';
import { EmptyState } from '@/components/EmptyState';
import { ProgressBar } from '@/components/ProgressBar';
import { ChoreListSkeleton } from '@/components/Skeleton';
import { isOccurrenceToday, toISODate } from '@/lib/date';
import { children, getCurrentWeek } from '@/lib/mockData';
import { calculateEarnedCents, calculateMaximumCents, formatCurrency } from '@/lib/money';
import { colors, spacing, typography } from '@/lib/theme';
import type { ChoreOccurrence } from '@/types/domain';

// Mock-only: simulates the brief loading period a real Supabase fetch would
// have, so the skeleton state has somewhere to appear (Phase 2+ replaces this
// with a real query).
const MOCK_LOAD_DELAY_MS = 300;

export default function WeekScreen() {
  const insets = useSafeAreaInsets();
  const [selectedChildId, setSelectedChildId] = useState(children[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [occurrencesByChild, setOccurrencesByChild] = useState<Record<string, ChoreOccurrence[]>>(
    () =>
      Object.fromEntries(children.map((child) => [child.id, getCurrentWeek(child.id).occurrences])),
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), MOCK_LOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const todayISO = toISODate(new Date());
  const occurrences = occurrencesByChild[selectedChildId] ?? [];

  const earnedCents = calculateEarnedCents(occurrences);
  const maximumCents = calculateMaximumCents(occurrences);
  const progress = maximumCents === 0 ? 0 : earnedCents / maximumCents;

  const sections = groupOccurrencesByStatus(occurrences, todayISO);

  function toggleOccurrence(occurrenceId: string) {
    setOccurrencesByChild((current) => ({
      ...current,
      [selectedChildId]: current[selectedChildId].map((occurrence) =>
        occurrence.id === occurrenceId
          ? {
              ...occurrence,
              status: occurrence.status === 'completed' ? 'pending' : 'completed',
            }
          : occurrence,
      ),
    }));
  }

  const childSwitcherItems = children.map((child) => {
    const childOccurrences = occurrencesByChild[child.id] ?? [];
    return {
      id: child.id,
      name: child.name,
      earnedCents: calculateEarnedCents(childOccurrences),
      maximumCents: calculateMaximumCents(childOccurrences),
    };
  });

  const hasAnyChores = occurrences.length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={typography.sectionLabel}>This week</Text>

      <ChildSwitcher
        items={childSwitcherItems}
        selectedId={selectedChildId}
        onSelect={setSelectedChildId}
      />

      <View style={styles.earnedBlock}>
        <Text style={typography.secondaryMeta}>Earned</Text>
        <Text style={typography.primaryNumber}>
          {formatCurrency(earnedCents)}{' '}
          <Text style={styles.maximum}>/ {formatCurrency(maximumCents)}</Text>
        </Text>
        <ProgressBar progress={progress} />
      </View>

      {isLoading ? (
        <ChoreListSkeleton />
      ) : !hasAnyChores ? (
        <EmptyState message="Nothing planned yet." />
      ) : (
        <>
          <ChoreSection title="Today" occurrences={sections.today} onToggle={toggleOccurrence} />
          <ChoreSection
            title="Later this week"
            occurrences={sections.later}
            onToggle={toggleOccurrence}
          />
          <ChoreSection
            title="Completed"
            occurrences={sections.completed}
            onToggle={toggleOccurrence}
          />
        </>
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
}

function ChoreSection({ title, occurrences, onToggle }: ChoreSectionProps) {
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
});
