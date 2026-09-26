import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Above everything, including auth screens — offline is worth
          knowing about even before signing in. */}
      <View style={styles.root}>
        <OfflineBanner />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

// Route access follows real auth/membership state, not anything the client
// could fake — signed_out/needs_family/active come from resolveAppState(),
// which is driven by the session and family_memberships row Supabase
// actually returned (section 77). Stack.Protected reacts to appState
// changing, so e.g. finishing "create family" switches straight to (tabs)
// with no manual navigation call needed.
function RootNavigator() {
  const { appState, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={appState.status === 'signed_out'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={appState.status === 'needs_family'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={appState.status === 'active'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="history/[weekId]"
          options={{ headerShown: true, headerTitle: 'Week', presentation: 'card' }}
        />
      </Stack.Protected>

      <Stack.Protected
        guard={appState.status === 'active' && appState.membership.role === 'parent'}
      >
        <Stack.Screen name="add-child" options={{ headerShown: true, headerTitle: 'Add child' }} />
        <Stack.Screen name="manage-chores" options={{ headerShown: true, headerTitle: 'Chores' }} />
        <Stack.Screen name="add-chore" options={{ headerShown: true, headerTitle: 'Add chore' }} />
        <Stack.Screen
          name="edit-chore/[choreId]"
          options={{ headerShown: true, headerTitle: 'Edit chore' }}
        />
        <Stack.Screen name="join-code" options={{ headerShown: true, headerTitle: 'Join code' }} />
        <Stack.Screen
          name="parent-pin"
          options={{ headerShown: true, headerTitle: 'Parent PIN' }}
        />
      </Stack.Protected>
    </Stack>
  );
}
