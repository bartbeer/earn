import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChoreForm } from '@/components/ChoreForm';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { deactivateChore, fetchChoreById, updateChore } from '@/lib/api/chores';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors, spacing, typography } from '@/lib/theme';
import type { Chore } from '@/types/domain';

export default function EditChoreScreen() {
  const { choreId } = useLocalSearchParams<{ choreId: string }>();
  const { appState } = useAuth();
  const familyId = appState.status === 'active' ? appState.membership.familyId : '';
  const { children } = useFamilyChildren(familyId);

  const [chore, setChore] = useState<Chore | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchChoreById(choreId).then((result) => {
      if (isMounted) {
        setChore(result);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [choreId]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!chore) {
    return (
      <View style={styles.centered}>
        <Text style={typography.body}>Chore not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ChoreForm
          childOptions={children}
          initialValues={chore}
          submitLabel="Save"
          onSubmit={async (values) => {
            await updateChore(chore.id, values);
            router.back();
          }}
          extraAction={{
            label: 'Deactivate chore',
            onPress: async () => {
              await deactivateChore(chore.id);
              router.back();
            },
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: spacing.lg,
  },
});
