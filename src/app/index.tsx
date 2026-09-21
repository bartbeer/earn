import { StyleSheet, Text, View } from 'react-native';

// Placeholder root screen for Phase 0 (project foundation).
// Phase 1 replaces this with the real Week / History / Settings navigation.
export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Earn!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
