import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';

/** Full-screen loading state shown while the initial session/membership check resolves. */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
