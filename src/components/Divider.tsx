import { StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';

/** A hairline separator between rows within a Card. */
export function Divider() {
  return <View style={styles.line} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
