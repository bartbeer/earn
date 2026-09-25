import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors, spacing, typography } from '@/lib/theme';
import type { RewardType } from '@/types/domain';

const REWARD_TYPE_OPTIONS: { value: RewardType; label: string }[] = [
  { value: 'currency', label: 'Euros' },
  { value: 'stars', label: 'Stars' },
];

// Reachable any time a parent is signed in — right after creating a family
// (via the Week screen's "Add your first child" empty state, section 88)
// or later from Settings. Not a one-time onboarding step. Adding a second
// child is just tapping "Add child" from Settings again — one add per
// visit here keeps this screen from doubling as its own mini list.
export default function AddChildScreen() {
  const { addChild } = useAuth();
  const [name, setName] = useState('');
  // Some parents don't want a younger child working for real money — stars
  // is a purely non-monetary alternative. Changeable later from Settings,
  // but only until the child has a chore (see the reward-type migration).
  const [rewardType, setRewardType] = useState<RewardType>('currency');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddChild() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await addChild(trimmed, rewardType);
      router.back();
    } catch {
      setError("Couldn't add that child. Try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={typography.screenTitle}>Add a child</Text>

        <View style={styles.form}>
          <TextField label="Name" value={name} onChangeText={setName} autoFocus />

          <View style={styles.field}>
            <Text style={typography.secondaryMeta}>Earns</Text>
            <View style={styles.chipRow}>
              {REWARD_TYPE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={option.value === rewardType}
                  onPress={() => setRewardType(option.value)}
                />
              ))}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={isSubmitting ? 'Adding…' : 'Add child'}
            onPress={handleAddChild}
            disabled={isSubmitting || !name.trim()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
});
