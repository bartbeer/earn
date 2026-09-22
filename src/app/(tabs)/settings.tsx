import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Divider } from '@/components/Divider';
import { SettingsRow } from '@/components/SettingsRow';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors, spacing, typography } from '@/lib/theme';

// A short, flat settings list — no nested menus (master spec section 27).
// Children see a minimal version: section 7 explicitly excludes them from
// parent management functionality. Rows here are display-only until their
// features exist: chores (Phase 4), join code (Phase 9), parent PIN (Phase 9).
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

      {isParent ? <ParentSections familyId={membership.familyId} /> : null}

      <Section title="Account">
        <SettingsRow label="Sign out" onPress={() => signOut()} />
      </Section>
    </ScrollView>
  );
}

function ParentSections({ familyId }: { familyId: string }) {
  const { children } = useFamilyChildren(familyId);

  return (
    <>
      <Section title="Allowance">
        <SettingsRow label="Week" value="Monday → Sunday" />
      </Section>

      <Section title="Children">
        {children.map((child) => (
          <View key={child.id}>
            <SettingsRow label={child.name} />
            <Divider />
          </View>
        ))}
        <SettingsRow label="Add a child" onPress={() => router.push('/add-child')} />
      </Section>

      <Section title="Chores">
        <SettingsRow label="Manage chores" onPress={() => {}} />
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
