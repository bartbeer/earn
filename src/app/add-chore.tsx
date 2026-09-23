import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { ChoreForm } from '@/components/ChoreForm';
import { useFamilyChildren } from '@/hooks/useFamilyChildren';
import { createChore } from '@/lib/api/chores';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors, spacing } from '@/lib/theme';

export default function AddChoreScreen() {
  const { appState } = useAuth();
  const familyId = appState.status === 'active' ? appState.membership.familyId : '';
  const { children } = useFamilyChildren(familyId);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ChoreForm
          childOptions={children}
          submitLabel="Add chore"
          onSubmit={async (values) => {
            await createChore({ familyId, ...values });
            router.back();
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
  content: {
    padding: spacing.lg,
  },
});
