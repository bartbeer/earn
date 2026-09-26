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

// @react-native-community/netinfo ships its own jest mock (same reasoning
// as react-native-safe-area-context above), which already defaults to a
// connected state — so this alone is enough for the many screens that now
// call useIsOffline() to render without each needing their own mock.
// Tests that specifically exercise offline behaviour override this
// locally (jest.mock('@/hooks/useIsOffline', ...) in that file takes
// precedence).
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);
