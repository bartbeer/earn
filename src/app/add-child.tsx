import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors, spacing, typography } from '@/lib/theme';

// Reachable any time a parent is signed in — right after creating a family
// (via the Week screen's "Add your first child" empty state, section 88)
// or later from Settings. Not a one-time onboarding step.
export default function AddChildScreen() {
  const { addChild } = useAuth();
  const [name, setName] = useState('');
  const [addedNames, setAddedNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddChild() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await addChild(trimmed);
      setAddedNames((current) => [...current, trimmed]);
      setName('');
    } catch {
      setError("Couldn't add that child. Try again.");
    } finally {
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

        {addedNames.length > 0 ? (
          <View style={styles.addedList}>
            {addedNames.map((addedName) => (
              <Text key={addedName} style={typography.body}>
                ✓ {addedName}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.form}>
          <TextField label="Name" value={name} onChangeText={setName} autoFocus />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={isSubmitting ? 'Adding…' : 'Add child'}
            onPress={handleAddChild}
            disabled={isSubmitting || !name.trim()}
          />
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
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
  addedList: {
    gap: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
});
