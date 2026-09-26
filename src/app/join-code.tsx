import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useIsOffline } from '@/hooks/useIsOffline';
import { rotateFamilyJoinCode } from '@/lib/api/family';
import { useAuth } from '@/lib/auth/AuthProvider';
import { describeFailure } from '@/lib/errorMessages';
import { colors, spacing, typography } from '@/lib/theme';

// Phase 9: parent-facing half of the join-code flow (Settings > Family >
// Join code). Auto-generates on open for a single, obvious first action
// (section 15) — the server only ever stores a hash, never the plaintext
// (section 79), so there's no way to "look up" a previously generated
// code; "Generate a new code" is the only way back if it's needed again or
// the parent waited too long / mistyped it while sharing it.
export default function JoinCodeScreen() {
  const { appState } = useAuth();
  const familyId = appState.status === 'active' ? appState.membership.familyId : '';
  const isOffline = useIsOffline();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts true: generation begins immediately on mount below.
  const [isGenerating, setIsGenerating] = useState(true);

  // Runs once on open, matching the fetch-on-mount pattern used elsewhere
  // (e.g. edit-chore) — a direct .then()/.catch() chain here, not a call
  // out to a helper that itself sets state, since generation also needs to
  // be re-triggerable from the button below without duplicating this.
  useEffect(() => {
    let isMounted = true;
    rotateFamilyJoinCode(familyId)
      .then((newCode) => {
        if (isMounted) setCode(newCode);
      })
      .catch(() => {
        if (isMounted) setError(describeFailure(isOffline, "Couldn't generate a code. Try again."));
      })
      .finally(() => {
        if (isMounted) setIsGenerating(false);
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGeneratePress() {
    setError(null);
    setIsGenerating(true);
    try {
      const newCode = await rotateFamilyJoinCode(familyId);
      setCode(newCode);
    } catch {
      setError(describeFailure(isOffline, "Couldn't generate a code. Try again."));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.screenTitle}>Join code</Text>
      <Text style={typography.body}>
        Share this code with your child so they can join your family. It expires in 24 hours.
      </Text>

      <View style={styles.codeBlock}>
        {isGenerating && !code ? (
          <ActivityIndicator color={colors.primary} />
        ) : code ? (
          <Text style={styles.code}>{code}</Text>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={isGenerating ? 'Generating…' : 'Generate a new code'}
        variant="secondary"
        onPress={handleGeneratePress}
        disabled={isGenerating}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
    alignItems: 'center',
  },
  codeBlock: {
    minHeight: 64,
    justifyContent: 'center',
  },
  code: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 8,
    color: colors.textPrimary,
  },
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
});
