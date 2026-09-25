import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { clearParentPin, hasParentPin, setParentPin } from '@/lib/api/family';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors, spacing, typography } from '@/lib/theme';

// Phase 9: the Parent PIN, a local gate on Settings' parent-only sections
// — not a second login, just protection against a child picking up an
// already-signed-in parent's device. Reachable from Settings > Security >
// Parent PIN, which (per the gate in settings.tsx) is itself only ever
// reachable after the PIN has already been entered correctly for this
// session when one exists — so this screen doesn't ask for the current
// PIN again before letting it be changed or removed.
export default function ParentPinScreen() {
  const { appState } = useAuth();
  const familyId = appState.status === 'active' ? appState.membership.familyId : '';
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    hasParentPin(familyId)
      .then((result) => {
        if (isMounted) setHasPin(result);
      })
      .catch(() => {
        if (isMounted) setHasPin(false);
      });
    return () => {
      isMounted = false;
    };
  }, [familyId]);

  async function handleSave() {
    setError(null);
    if (!/^\d{4,6}$/.test(pin.trim())) {
      setError('PIN must be 4 to 6 digits.');
      return;
    }
    setIsSaving(true);
    try {
      await setParentPin(familyId, pin.trim());
      router.back();
    } catch {
      setError("Couldn't save that. Try again.");
      setIsSaving(false);
    }
  }

  function confirmRemove() {
    Alert.alert('Remove Parent PIN?', 'Settings will no longer be locked.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await clearParentPin(familyId);
          router.back();
        },
      },
    ]);
  }

  if (hasPin === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.screenTitle}>Parent PIN</Text>
      <Text style={typography.body}>
        {hasPin
          ? "Change the PIN required to open Settings' parent sections."
          : "Set a PIN to lock Settings' parent sections — handy if this device sometimes ends up in your child's hands while you're still signed in."}
      </Text>

      <View style={styles.form}>
        <TextField
          label="New PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={isSaving ? 'Saving…' : hasPin ? 'Change PIN' : 'Set PIN'}
          onPress={handleSave}
          disabled={isSaving || !pin.trim()}
        />

        {hasPin ? (
          <Button label="Remove PIN" variant="secondary" onPress={confirmRemove} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  form: {
    gap: spacing.lg,
  },
  error: {
    color: '#B3261E',
    fontSize: 14,
  },
});
