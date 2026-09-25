import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { resolveFamilyJoinCode, type ResolvedJoinCode } from '@/lib/api/family';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors, spacing, typography } from '@/lib/theme';

// Onboarding alternative to creating a family (master spec section 79's
// secure join-code flow, Phase 9): a child signs up for their own account
// the normal way, then redeems the code a parent generated for them
// (Settings > Family > Join code) to link that account to one of the
// family's existing children.
export default function JoinFamilyScreen() {
  const { joinFamily } = useAuth();
  const [code, setCode] = useState('');
  const [resolved, setResolved] = useState<ResolvedJoinCode | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  async function handleFindFamily() {
    setError(null);
    setResolved(null);
    setSelectedChildId(null);
    setIsResolving(true);
    try {
      const result = await resolveFamilyJoinCode(code.trim());
      setResolved(result);
    } catch {
      setError("That code isn't valid — check with your parent and try again.");
    } finally {
      setIsResolving(false);
    }
  }

  async function handleJoin() {
    if (!selectedChildId) return;
    setError(null);
    setIsJoining(true);
    try {
      await joinFamily(code.trim(), selectedChildId);
      // No manual navigation: once this succeeds, appState flips to
      // 'active' and the root layout's Stack.Protected guards react on
      // their own, same as createFamily().
    } catch {
      setError("Couldn't join. Try again.");
      setIsJoining(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={typography.screenTitle}>Join your family</Text>

        <View style={styles.form}>
          <TextField
            label="Join code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="123456"
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!resolved ? (
            <Button
              label={isResolving ? 'Looking…' : 'Find my family'}
              onPress={handleFindFamily}
              disabled={isResolving || !code.trim()}
            />
          ) : (
            <>
              <Text style={typography.body}>
                {resolved.familyName ? `${resolved.familyName} — ` : ''}Who are you?
              </Text>

              {resolved.children.length === 0 ? (
                <Text style={typography.secondaryMeta}>
                  Everyone in this family has already joined. Ask a parent for help.
                </Text>
              ) : (
                <View style={styles.chipRow}>
                  {resolved.children.map((child) => (
                    <Chip
                      key={child.id}
                      label={child.name}
                      selected={child.id === selectedChildId}
                      onPress={() => setSelectedChildId(child.id)}
                    />
                  ))}
                </View>
              )}

              <Button
                label={isJoining ? 'Joining…' : 'Join'}
                onPress={handleJoin}
                disabled={isJoining || !selectedChildId}
              />
            </>
          )}
        </View>

        <Link href="/(onboarding)/create-family" style={styles.link}>
          <Text style={typography.secondaryMeta}>Starting a new family instead? Create one</Text>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
