import type { ReactElement } from 'react';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

// Screens call useSafeAreaInsets(), which throws without a SafeAreaProvider
// ancestor. The real app provides one in src/app/_layout.tsx; tests that
// render a screen in isolation need the same wrapper.
export function withSafeArea(children: ReactElement) {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}>{children}</SafeAreaProvider>;
}
