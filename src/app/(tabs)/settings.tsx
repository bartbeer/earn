import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Divider } from '@/components/Divider';
import { SettingsRow } from '@/components/SettingsRow';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { useAuth } from '@/lib/auth/AuthProvider';
import { deactivateChild, forceSwitchChildRewardType, updateChildRewardType } from '@/lib/api/family';
import { colors, spacing, typography } from '@/lib/theme';
import type { Child, RewardType } from '@/types/domain';

// A short, flat settings list — no nested menus (master spec section 27).
// Children see a minimal version: section 7 explicitly excludes them from
// parent management functionality. Parent PIN is still display-only.
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

  function rewardTypeLabel(rewardType: RewardType) {
    return rewardType === 'stars' ? 'Stars' : 'Euros';
  }

  async function handleSwitchRewardType(child: Child) {
    const nextRewardType: RewardType = child.rewardType === 'stars' ? 'currency' : 'stars';
    try {
      await updateChildRewardType(child.id, nextRewardType);
      refetch();
    } catch {
      // The server locks this while the child has an active chore or any
      // recorded chore history — there's no safe way to reinterpret an
      // already-recorded amount in the other unit. Offer the explicit,
      // destructive override rather than just failing here.
      confirmForceSwitchRewardType(child, nextRewardType);
    }
  }

  function confirmForceSwitchRewardType(child: Child, nextRewardType: RewardType) {
    Alert.alert(
      "Can't change this yet",
      `${child.name} already has chore history. Switching to ${rewardTypeLabel(nextRewardType).toLowerCase()} now will permanently delete their completed chore history and turn off any chores still set up for them. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete history & switch',
          style: 'destructive',
          onPress: async () => {
            try {
              await forceSwitchChildRewardType(child.id, nextRewardType);
              refetch();
            } catch {
              // The one thing even the destructive override never removes:
              // a paid week is a real record of money/stars already given.
              Alert.alert(
                "Still can't change this",
                `${child.name} has a paid week on record, which is never deleted — their reward type can't be changed anymore.`,
              );
            }
          },
        },
      ],
    );
  }

  function confirmChildAction(child: Child) {
    // A confirmation here is deliberate even though section 15 says not to
    // add one for routine actions like checking off a chore — removing a
    // child is a rare, hard-to-notice-if-reversed action, not a checkbox.
    Alert.alert(child.name, `Currently earns ${rewardTypeLabel(child.rewardType).toLowerCase()}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: child.rewardType === 'stars' ? 'Switch to Euros' : 'Switch to Stars',
        onPress: () => handleSwitchRewardType(child),
      },
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
            <SettingsRow
              label={child.name}
              value={rewardTypeLabel(child.rewardType)}
              onPress={() => confirmChildAction(child)}
            />
            <Divider />
          </View>
        ))}
        <SettingsRow label="Add a child" onPress={() => router.push('/add-child')} />
      </Section>

      <Section title="Chores">
        <SettingsRow label="Manage chores" onPress={() => router.push('/manage-chores')} />
      </Section>

      <Section title="Family">
        <SettingsRow label="Join code" onPress={() => router.push('/join-code')} />
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
