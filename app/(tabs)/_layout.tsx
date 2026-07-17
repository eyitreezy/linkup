/**
 * Main tab navigation — Plans, Messages, Profile.
 */
import { LinkUpTabBar } from '@/components/navigation/LinkUpTabBar';
import { colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { TabBarVisibilityProvider } from '@/contexts/TabBarVisibilityContext';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, type Href } from 'expo-router';
import { View } from 'react-native';

export default function TabsLayout() {
  const { session, profile, loading } = useAuth();

  if (!session) {
    return <Redirect href={'/(auth)/login' as Href} />;
  }
  if (loading) {
    return null;
  }
  if (profile?.onboarding_status === 'pending') {
    return <Redirect href={'/onboarding' as Href} />;
  }

  return (
    <TabBarVisibilityProvider>
      <Tabs
        tabBar={(props) => <LinkUpTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          headerStyle: { backgroundColor: colors.splashBackground },
          headerTintColor: colors.text,
          headerTitle: () => null,
          tabBarShowLabel: false,
          tabBarBackground: () => <View style={{ backgroundColor: 'transparent' }} />,
          sceneContainerStyle: { backgroundColor: colors.splashBackground },
          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 0,
            minHeight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            elevation: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="meetr"
        options={{
          headerShown: false,
          tabBarLabel: 'Meetr',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" color={color} size={size + 4} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          headerShown: false,
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          headerShown: false,
          tabBarLabel: 'Saved',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          headerShown: false,
          tabBarLabel: 'Offers',
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetag" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
      </Tabs>
    </TabBarVisibilityProvider>
  );
}
