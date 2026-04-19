/**
 * Unknown route — expo-router fallback.
 */
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ headerTitle: () => null }} />
      <View style={styles.box}>
        <Text style={styles.t}>This screen does not exist.</Text>
        <Link href="/(tabs)" style={styles.link}>
          Go home
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  t: { fontSize: 16, color: colors.text, marginBottom: 16 },
  link: { color: colors.primary, fontWeight: '600' },
});
