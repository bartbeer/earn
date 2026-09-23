import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Divider } from '@/components/Divider';
import { SettingsRow } from '@/components/SettingsRow';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { useAuth } from '@/lib/auth/AuthProvider';
import { deactivateChild } from '@/lib/api/family';
import { colors, spacing, typography } from '@/lib/theme';
import type { Child } from '@/types/domain';

// A short, flat settings list — no nested menus (master spec section 27).
// Children see a minimal version: section 7 explicitly excludes them from
// parent management functionality. Join code and Parent PIN are still
// display-only — those features land in Phase 9.
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { appState, signOut } = useAuth();

  if (appState.status !== 'active') return null;
  const { membership } = appState;
  const isParent = membership.role === 'parent';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={typography.screenTitle}>Settings</Text>

      {/* Sign out first, not last — a parent's settings has several cards
          below it (Allowance/Children/Chores/Family/Security), and burying
          this at the bottom meant scrolling past all of them to find it. */}
      <Section title="Account">
        <SettingsRow label="Sign out" onPress={() => signOut()} />
      </Section>

      {isParent ? <ParentSections familyId={membership.familyId} /> : null}
    </ScrollView>
  );
}

function ParentSections({ familyId }: { familyId: string }) {
  const { children, refetch } = useFamilyChildren(familyId);

  function confirmRemove(child: Child) {
    // A confirmation here is deliberate even though section 15 says not to
    // add one for routine actions like checking off a chore — removing a
    // child is a rare, hard-to-notice-if-reversed action, not a checkbox.
    Alert.alert(`Remove ${child.name}?`, "They'll no longer appear in the app.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deactivateChild(child.id);
          refetch();
        },
      },
    ]);
  }

  return (
    <>
      <Section title="Allowance">
        <SettingsRow label="Week" value="Monday → Sunday" />
      </Section>

      <Section title="Children">
        {children.map((child) => (
          <View key={child.id}>
            <SettingsRow label={child.name} onPress={() => confirmRemove(child)} />
            <Divider />
          </View>
        ))}
        <SettingsRow label="Add a child" onPress={() => router.push('/add-child')} />
      </Section>

      <Section title="Chores">
        <SettingsRow label="Manage chores" onPress={() => router.push('/manage-chores')} />
      </Section>

      <Section title="Family">
        <SettingsRow label="Join code" onPress={() => {}} />
      </Section>

      <Section title="Security">
        <SettingsRow label="Parent PIN" onPress={() => {}} />
      </Section>
    </>
  );
}

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text style={typography.sectionLabel}>{title}</Text>
      <Card>{children}</Card>
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
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
});
