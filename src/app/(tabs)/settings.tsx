import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Divider } from '@/components/Divider';
import { SettingsRow } from '@/components/SettingsRow';
import { children } from '@/lib/mockData';
import { colors, spacing, typography } from '@/lib/theme';

// A short, flat settings list — no nested menus (master spec section 27).
// Rows here are display-only until their features exist: children (Phase 4),
// chores (Phase 4), join code (Phase 9), parent PIN (Phase 9).
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={typography.screenTitle}>Settings</Text>

      <Section title="Allowance">
        <SettingsRow label="Week" value="Monday → Sunday" />
      </Section>

      <Section title="Children">
        {children.map((child, index) => (
          <View key={child.id}>
            {index > 0 ? <Divider /> : null}
            <SettingsRow label={child.name} onPress={() => {}} />
          </View>
        ))}
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
    </ScrollView>
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
