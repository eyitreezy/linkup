/**
 * Discovery-style profile preview — photo-forward card (swipe-app pattern),
 * interest pills, Hinge-style prompt + answer blocks.
 */
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius } from '@/constants/theme';
import { ageFromBirthDate } from '@/lib/onboarding/hydrate';
import type { MeetingIntent, OnboardingDraft } from '@/types/onboarding';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { resolveDraftPhotoUrls } from '@/lib/profile/media/photoOrder';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';

type Props = {
  draft: OnboardingDraft;
  /** Full scroll width (e.g. edit profile). Default: centered phone-width card. */
  fullWidth?: boolean;
};

/** Same horizontal gradient as selected chips in TagSelector. */
const INTEREST_PILL_GRADIENT = [colors.primary, '#8B7CE8', colors.secondary] as const;

const intentLabel = (m: MeetingIntent | null): string | null => {
  if (!m) return null;
  if (m === 'dating') return 'Dating';
  if (m === 'friendship') return 'New friends';
  return 'Activities';
};

export function ProfileCardPreview({ draft, fullWidth = false }: Props) {
  const { width: winW } = useWindowDimensions();
  const photos = resolveDraftPhotoUrls(
    draft.remotePhotoUrls,
    draft.localPhotoUris,
    draft.primaryPhotoRef
  );
  const heroUri = photos[0] ?? null;
  const morePhotos = photos.length > 1 ? photos.slice(1) : [];
  const age = ageFromBirthDate(draft.birthDate);
  const intent = intentLabel(draft.meetingIntent);

  const cardSizeStyle = fullWidth ? styles.cardFull : { maxWidth: Math.min(winW - onboarding.spacing.lg * 2, 420) };

  return (
    <View style={[styles.outer, fullWidth && styles.outerFull]}>
      <View style={[styles.card, cardSizeStyle]}>
        {/* Tinder-style: full-bleed photo, name on gradient */}
        <View style={styles.hero}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          {intent ? (
            <View style={styles.intentPill}>
              <Text style={styles.intentPillTxt}>{intent}</Text>
            </View>
          ) : null}
          <Text style={styles.name} numberOfLines={2}>
            {draft.displayName.trim() || 'Your name'}
            {age ? `, ${age}` : ''}
          </Text>
        </View>

        <View style={styles.body}>
          {hasValidProfileLocation(draft) ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <Text style={styles.locationTxt} numberOfLines={2}>
                {draft.locationLabel.trim()}
              </Text>
            </View>
          ) : null}
          {/* Bumble-style hierarchy: section labels */}
          {draft.bio.trim().length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>About me</Text>
              <Text style={styles.bio}>{draft.bio.trim()}</Text>
            </View>
          ) : null}

          {draft.interests.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Interests</Text>
              <View style={styles.tags}>
                {draft.interests.map((t) => (
                  <LinearGradient
                    key={t}
                    colors={[...INTEREST_PILL_GRADIENT]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tagGradient}
                  >
                    <Text style={styles.tagTextOn}>{t}</Text>
                  </LinearGradient>
                ))}
              </View>
            </View>
          ) : null}

          {/* Hinge-style: prompt as small label, answer as story */}
          {draft.promptAnswers.map(
            (p) =>
              p.answer.trim().length > 0 && (
                <View key={p.promptId} style={styles.promptCard}>
                  <Text style={styles.promptQ}>{p.prompt}</Text>
                  <Text style={styles.promptA}>{p.answer.trim()}</Text>
                </View>
              )
          )}

          {morePhotos.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>More photos</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.morePhotosRow}
              >
                {morePhotos.map((u, i) => (
                  <Image key={`${u}-${i}`} source={{ uri: u }} style={styles.thumb} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', width: '100%' },
  outerFull: { alignItems: 'stretch' },
  card: {
    width: '100%',
    borderRadius: onboarding.radius2xl + 6,
    overflow: 'hidden',
    backgroundColor: onboarding.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    ...onboarding.shadow,
  },
  cardFull: {
    maxWidth: '100%',
  },
  hero: {
    width: '100%',
    aspectRatio: 0.78,
    justifyContent: 'flex-end',
  },
  heroImg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E8EAEF' },
  heroPlaceholder: { backgroundColor: 'rgba(0,0,0,0.06)' },
  intentPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  intentPillTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: onboarding.text,
    letterSpacing: 0.2,
  },
  name: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  body: {
    paddingHorizontal: onboarding.spacing.lg,
    paddingTop: onboarding.spacing.lg,
    paddingBottom: onboarding.spacing.xl,
    gap: onboarding.spacing.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  locationTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: onboarding.text,
    lineHeight: 19,
  },
  section: { marginBottom: 0, gap: 0 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: onboarding.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: onboarding.spacing.sm,
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
    color: onboarding.text,
    fontWeight: '500',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
  },
  tagTextOn: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  promptCard: {
    marginBottom: 0,
    padding: onboarding.spacing.md,
    borderRadius: radius.button,
    backgroundColor: '#F4F6F9',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  promptQ: {
    fontSize: 13,
    fontWeight: '700',
    color: onboarding.muted,
    marginBottom: onboarding.spacing.sm,
    lineHeight: 18,
  },
  promptA: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: onboarding.text,
    letterSpacing: -0.2,
  },
  morePhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: onboarding.spacing.sm,
    paddingVertical: 2,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: '#eee',
  },
});
