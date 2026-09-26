import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useIsOffline } from '@/hooks/useIsOffline';
import { useAuth } from '@/lib/auth/AuthProvider';
import { describeFailure } from '@/lib/errorMessages';
import { colors, spacing, typography } from '@/lib/theme';

// Section 8: Supabase Auth, not home-grown. Email/password sign-in; a
// child's own account is created the same way (sign-up.tsx) and then
// linked to the family via a join code (Phase 9, (onboarding)/join-family).
export default function SignInScreen() {
  const { signIn } = useAuth();
  const isOffline = useIsOffline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      // Never surface raw backend errors to the user (section 87). A
      // network failure would otherwise show this exact wording too,
      // wrongly suggesting a typo when the real problem is no connection.
      setError(describeFailure(isOffline, "Couldn't sign in. Check your email and password and try again."));
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
        <Text style={typography.screenTitle}>Earn!</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={isSubmitting ? 'Signing in…' : 'Sign in'}
            onPress={handleSubmit}
            disabled={isSubmitting || !email || !password}
          />
        </View>

        <Link href="/(auth)/sign-up" style={styles.link}>
          <Text style={typography.secondaryMeta}>New family? Create an account</Text>
        </Link>

        <Link href="/(auth)/forgot-password" style={styles.link}>
          <Text style={typography.secondaryMeta}>Forgot your password?</Text>
        </Link>
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
