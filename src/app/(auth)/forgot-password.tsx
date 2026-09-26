import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useIsOffline } from '@/hooks/useIsOffline';
import { useAuth } from '@/lib/auth/AuthProvider';
import { describeFailure } from '@/lib/errorMessages';
import { colors, spacing, typography } from '@/lib/theme';

// A forgotten password otherwise left a parent (or a child with their own
// account) permanently locked out — no reset flow existed anywhere. Reuses
// the same "type in a code" pattern as the join-code flow instead of a
// deep-link/universal-link reset, which this app has no other reason to
// set up: the recovery email (supabase/templates/recovery.html) is
// customized to show the raw 6-digit code rather than a clickable link.
export default function ForgotPasswordScreen() {
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const isOffline = useIsOffline();
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleSendCode() {
    setError(null);
    setIsSendingCode(true);
    try {
      await requestPasswordReset(email.trim());
      setCodeSent(true);
    } catch {
      setError(describeFailure(isOffline, "Couldn't send that. Try again."));
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleResetPassword() {
    setError(null);
    setIsResetting(true);
    try {
      await confirmPasswordReset(email.trim(), code.trim(), newPassword);
      // No manual navigation: this signs the user in with the new
      // password already set, appState flips, and the root layout's
      // Stack.Protected guards react on their own.
    } catch {
      setError(describeFailure(isOffline, "That code isn't right, or it's expired. Try again."));
      setIsResetting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={typography.screenTitle}>Reset your password</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!codeSent}
            autoFocus
          />

          {!codeSent ? (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label={isSendingCode ? 'Sending…' : 'Send code'}
                onPress={handleSendCode}
                disabled={isSendingCode || !email.trim()}
              />
            </>
          ) : (
            <>
              <Text style={typography.body}>
                If that email has an account, we&rsquo;ve sent it a 6-digit code. Enter it below
                along with your new password.
              </Text>

              <TextField
                label="Code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="123456"
              />
              <TextField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="password-new"
                textContentType="newPassword"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                label={isResetting ? 'Resetting…' : 'Reset password'}
                onPress={handleResetPassword}
                disabled={isResetting || !code.trim() || !newPassword}
              />
              <Button
                label={isSendingCode ? 'Sending…' : 'Resend code'}
                variant="secondary"
                onPress={handleSendCode}
                disabled={isSendingCode}
              />
            </>
          )}
        </View>

        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text style={typography.secondaryMeta}>Back to sign in</Text>
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
