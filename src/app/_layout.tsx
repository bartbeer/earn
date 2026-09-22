import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

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
      </Stack.Protected>
    </Stack>
  );
}
