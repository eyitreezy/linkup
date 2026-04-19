/**
 * Entry redirect — unauthenticated → login; pending onboarding → wizard; else tabs.
 */
import { colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  const needsOnboarding = !profile || profile.onboarding_status === 'pending';
  if (needsOnboarding) {
    return <Redirect href={'/onboarding' as Href} />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
