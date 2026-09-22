import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors, spacing, typography } from '@/lib/theme';

// A parent creating a normal Supabase Auth account. Once signed up, the
// root layout's route guard sends them straight to "create your family" —
// there is no separate confirmation step here.
export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
    } catch {
      setError("Couldn't create your account. Try a different email or a longer password.");
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
        <Text style={typography.screenTitle}>Create your account</Text>

        <View style={styles.form}>
          <TextField label="Your name" value={displayName} onChangeText={setDisplayName} />
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
            autoComplete="password-new"
            textContentType="newPassword"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={isSubmitting ? 'Creating account…' : 'Continue'}
            onPress={handleSubmit}
            disabled={isSubmitting || !email || !password || !displayName}
          />
        </View>

        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text style={typography.secondaryMeta}>Already have an account? Sign in</Text>
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
