/**
 * Cold-start splash overlay — minimum brand display, then hands off to the app.
 */
import { AppSplashScreen } from '@/components/splash/AppSplashScreen';
import { APP_SPLASH_DURATION_MS } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

void SplashScreen.preventAutoHideAsync().catch(() => {});

type Props = {
  children: ReactNode;
};

export function SplashGate({ children }: Props) {
  const { loading: authLoading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), APP_SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minTimeElapsed || authLoading) return;

    Animated.timing(fade, {
      toValue: 0,
      duration: 420,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setOverlayVisible(false);
    });
  }, [authLoading, fade, minTimeElapsed]);

  const onSplashLayout = () => {
    if (nativeSplashHidden) return;
    setNativeSplashHidden(true);
    void SplashScreen.hideAsync().catch(() => {});
  };

  return (
    <View style={styles.root}>
      {children}
      {overlayVisible ? (
        <Animated.View
          pointerEvents="auto"
          onLayout={onSplashLayout}
          style={[styles.overlay, { opacity: fade }]}
        >
          <StatusBar style="light" />
          <AppSplashScreen />
        </Animated.View>
      ) : (
        <StatusBar style="dark" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
