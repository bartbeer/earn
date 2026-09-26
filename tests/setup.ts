// Global Jest setup. react-native-safe-area-context has native code with no
// JS behaviour to fall back on in a test environment, so it ships its own
// jest mock that every test run needs (per the library's own docs).
//
// The shipped mock module only has a default export (an object of named
// values); requiring it directly leaves named imports like
// `{ SafeAreaProvider }` undefined, so it must be unwrapped here.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// Default every test to "online" so the many screens that now call
// useIsOffline() don't each need their own expo-network mock just to
// render at all. Tests that specifically exercise offline behaviour
// override this locally (jest.mock('expo-network', ...) or
// jest.mock('@/hooks/useIsOffline', ...) in that file take precedence).
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true, type: 'WIFI' }),
}));
