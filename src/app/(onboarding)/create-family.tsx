import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useIsOffline } from '@/hooks/useIsOffline';
import { useAuth } from '@/lib/auth/AuthProvider';
import { describeFailure } from '@/lib/errorMessages';
import { colors, spacing, typography } from '@/lib/theme';

// Onboarding step 1 (master spec section 92) — deliberately just one field.
export default function CreateFamilyScreen() {
  const { createFamily, signOut } = useAuth();
  const isOffline = useIsOffline();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await createFamily(name.trim());
      // No manual navigation: once this succeeds, appState flips to
      // 'active' and the root layout's Stack.Protected guards react by
      // switching to the (tabs) group on their own. Adding a child is a
      // normal action reachable anytime from there (section 88's "Add your
      // first child" empty state), not a forced onboarding step.
    } catch {
      setError(describeFailure(isOffline, "Couldn't create your family. Try again."));
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
        <Text style={typography.screenTitle}>Create your family</Text>

        <View style={styles.form}>
          <TextField
            label="Family name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. The Smiths"
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={isSubmitting ? 'Creating…' : 'Continue'}
            onPress={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          />
        </View>

        <Link href="/(onboarding)/join-family" style={styles.link}>
          <Text style={typography.secondaryMeta}>Joining an existing family? Enter a join code</Text>
        </Link>

        {/* No way back otherwise: a brand-new sign-up with no family yet has
            no tabs, no menu — without this, a wrong account leaves the
            screen with no way out at all. */}
        <Pressable onPress={() => signOut()} style={styles.link}>
          <Text style={typography.secondaryMeta}>Wrong account? Sign out</Text>
        </Pressable>
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
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
  link: {
    alignSelf: 'center',
    padding: spacing.sm,
  },
});
