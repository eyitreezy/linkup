/**
 * Full-screen auth hero carousel — background layer only.
 */
import { AuthHeroContext } from '@/components/auth/AuthHeroContext';
import { colors } from '@/constants/theme';
import { DATING_AUTH_HERO_SLIDES, type AuthHeroSlide } from '@/lib/auth/datingAuthHeroSlides';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const SLIDE_HOLD_MS = 7800;
const CROSSFADE_MS = 720;
const EASE_CROSSFADE = Easing.bezier(0.4, 0, 0.2, 1);

type Props = {
  children: ReactNode;
};

export function AuthHeroBackground({ children }: Props) {
  const slides: AuthHeroSlide[] = DATING_AUTH_HERO_SLIDES;
  const hasSlides = slides.length > 0;
  const [slideIndex, setSlideIndex] = useState(0);
  const slideIndexRef = useRef(0);
  slideIndexRef.current = slideIndex;

  const slideOpacitiesRef = useRef<Animated.Value[]>([]);
  if (slideOpacitiesRef.current.length !== slides.length) {
    slideOpacitiesRef.current = slides.map((_, i) => new Animated.Value(i === slideIndex ? 1 : 0));
  }

  const fadeToSlide = useCallback(
    (nextIndex: number) => {
      if (!hasSlides || nextIndex < 0 || nextIndex >= slides.length) return;
      if (nextIndex === slideIndexRef.current) return;
      const op = slideOpacitiesRef.current;
      const prev = slideIndexRef.current;
      op.forEach((v) => v.stopAnimation());
      op.forEach((v, j) => {
        if (j !== prev && j !== nextIndex) v.setValue(0);
      });
      op[prev].setValue(1);
      op[nextIndex].setValue(0);
      slideIndexRef.current = nextIndex;
      setSlideIndex(nextIndex);
      Animated.parallel([
        Animated.timing(op[prev], {
          toValue: 0,
          duration: CROSSFADE_MS,
          easing: EASE_CROSSFADE,
          useNativeDriver: true,
        }),
        Animated.timing(op[nextIndex], {
          toValue: 1,
          duration: CROSSFADE_MS,
          easing: EASE_CROSSFADE,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [hasSlides, slides.length]
  );

  useEffect(() => {
    if (!hasSlides || slides.length < 2) return;
    const id = setInterval(() => {
      fadeToSlide((slideIndexRef.current + 1) % slides.length);
    }, SLIDE_HOLD_MS);
    return () => clearInterval(id);
  }, [hasSlides, slides.length, fadeToSlide]);

  const ctx = {
    slides,
    slideIndex,
    slideOpacities: slideOpacitiesRef.current,
    fadeToSlide,
  };

  return (
    <AuthHeroContext.Provider value={ctx}>
      <View style={styles.root}>
        {hasSlides ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {slides.map((slide, i) => (
              <Animated.View
                key={`bg-${i}`}
                style={[StyleSheet.absoluteFillObject, { opacity: slideOpacitiesRef.current[i] }]}
              >
                <Image source={slide.source} style={styles.image} contentFit="cover" priority="high" />
              </Animated.View>
            ))}
            <LinearGradient
              colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(26,20,45,0.45)', 'rgba(108,99,255,0.18)', 'rgba(255,101,132,0.22)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        ) : (
          <LinearGradient
            colors={[colors.authGradientTop, colors.authGradientMid, colors.authGradientBottom]}
            style={StyleSheet.absoluteFill}
          />
        )}

        <View style={styles.foreground} pointerEvents="box-none">
          {children}
        </View>
      </View>
    </AuthHeroContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  image: { width: '100%', height: '100%' },
  foreground: { flex: 1, zIndex: 1 },
});
