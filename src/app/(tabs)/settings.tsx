import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Divider } from '@/components/Divider';
import { SettingsRow } from '@/components/SettingsRow';
import { TextField } from '@/components/TextField';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { useIsOffline } from '@/hooks/useIsOffline';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  deactivateChild,
  forceSwitchChildRewardType,
  hasParentPin,
  updateChildRewardType,
  verifyParentPin,
} from '@/lib/api/family';
import { describeFailure } from '@/lib/errorMessages';
import { colors, spacing, typography } from '@/lib/theme';
import type { Child, RewardType } from '@/types/domain';

// A short, flat settings list — no nested menus (master spec section 27).
// Children see a minimal version: section 7 explicitly excludes them from
// parent management functionality.
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
  const isOffline = useIsOffline();

  // Undefined = still checking whether a PIN is even required; once known,
  // isUnlocked starts true if there's nothing to gate. It only ever flips
  // to false→true (never back), so once entered correctly it stays open
  // for the rest of this app session — this state lives in a component
  // that persists across tab switches (React Navigation keeps tab screens
  // mounted), so it naturally resets only on a full app reload, which is
  // the point: someone else picking the device back up later means a
  // fresh launch, not just a tab switch.
  const [pinRequired, setPinRequired] = useState<boolean | undefined>(undefined);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let isMounted = true;
    hasParentPin(familyId)
      .then((required) => {
        if (isMounted) {
          setPinRequired(required);
          if (!required) setIsUnlocked(true);
        }
      })
      .catch(() => {
        // Fails open rather than locking a parent out of their own
        // Settings over a network hiccup — the PIN is a convenience gate,
        // not the app's real security boundary (that's auth + RLS).
        if (isMounted) {
          setPinRequired(false);
          setIsUnlocked(true);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [familyId]);

  async function handleUnlock() {
    setPinError(null);
    setIsVerifying(true);
    try {
      const correct = await verifyParentPin(familyId, pinInput.trim());
      if (correct) {
        setIsUnlocked(true);
      } else {
        setPinError('Wrong PIN. Try again.');
      }
    } catch {
      setPinError(describeFailure(isOffline, "Couldn't check that. Try again."));
    } finally {
      setIsVerifying(false);
      setPinInput('');
    }
  }

  function rewardTypeLabel(rewardType: RewardType) {
    return rewardType === 'stars' ? 'Stars' : 'Euros';
  }

  async function handleSwitchRewardType(child: Child) {
    const nextRewardType: RewardType = child.rewardType === 'stars' ? 'currency' : 'stars';
    try {
      await updateChildRewardType(child.id, nextRewardType);
      refetch();
    } catch {
      // A plain network failure here would otherwise always fall through
      // to "you have chore history, delete it to switch?" — wrongly
      // offering a destructive override for a problem that has nothing to
      // do with chore history at all.
      if (isOffline) {
        Alert.alert("Can't change this", describeFailure(true));
        return;
      }
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
              if (isOffline) {
                Alert.alert("Can't change this", describeFailure(true));
                return;
              }
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
          try {
            await deactivateChild(child.id);
            refetch();
          } catch {
            Alert.alert("Couldn't remove", describeFailure(isOffline));
          }
        },
      },
    ]);
  }

  if (pinRequired === undefined) return null;

  if (!isUnlocked) {
    return (
      <Section title="Settings locked">
        <View style={styles.pinGate}>
          <Text style={typography.body}>Enter the Parent PIN to continue.</Text>
          <TextField
            label="Parent PIN"
            value={pinInput}
            onChangeText={setPinInput}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
          />
          {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
          <Button
            label={isVerifying ? 'Checking…' : 'Unlock'}
            onPress={handleUnlock}
            disabled={isVerifying || !pinInput.trim()}
          />
        </View>
      </Section>
    );
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
        <SettingsRow label="Parent PIN" onPress={() => router.push('/parent-pin')} />
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
  pinGate: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  error: {
    color: '#B3261E',
    fontSize: 14,
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
