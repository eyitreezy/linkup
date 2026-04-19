/**
 * Discovery-style profile preview — photo-forward card (swipe-app pattern),
 * interest pills, Hinge-style prompt + answer blocks.
 */
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { radius } from '@/constants/theme';
import { ageFromBirthDate } from '@/lib/onboarding/hydrate';
import type { MeetingIntent, OnboardingDraft } from '@/types/onboarding';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type Props = { draft: OnboardingDraft };

const intentLabel = (m: MeetingIntent | null): string | null => {
  if (!m) return null;
  if (m === 'dating') return 'Dating';
  if (m === 'friendship') return 'New friends';
  return 'Activities';
};

export function ProfileCardPreview({ draft }: Props) {
  const { width: winW } = useWindowDimensions();
  const uri = draft.localPhotoUris[0] ?? draft.remotePhotoUrls[0];
  const age = ageFromBirthDate(draft.birthDate);
  const photos = [...draft.remotePhotoUrls, ...draft.localPhotoUris];
  const intent = intentLabel(draft.meetingIntent);

  return (
    <View style={styles.outer}>
      <View style={[styles.card, { maxWidth: Math.min(winW - onboarding.spacing.lg * 2, 420) }]}>
        {/* Tinder-style: full-bleed photo, name on gradient */}
        <View style={styles.hero}>
          {uri ? (
            <Image source={{ uri }} style={styles.heroImg} resizeMode="cover" />
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
                  <View key={t} style={styles.tagWrap}>
                    <Text style={styles.tag}>{t}</Text>
                  </View>
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

          {photos.length > 1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>More photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {photos.slice(1).map((u, i) => (
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
  card: {
    width: '100%',
    borderRadius: onboarding.radius2xl + 6,
    overflow: 'hidden',
    backgroundColor: onboarding.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    ...onboarding.shadow,
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
    paddingHorizontal: onboarding.spacing.md + 2,
    paddingTop: onboarding.spacing.md + 2,
    paddingBottom: onboarding.spacing.lg,
  },
  section: { marginBottom: onboarding.spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: onboarding.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
    color: onboarding.text,
    fontWeight: '500',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: onboarding.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.25)',
  },
  tag: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  promptCard: {
    marginBottom: onboarding.spacing.md,
    padding: onboarding.spacing.md,
    borderRadius: onboarding.radius2xl,
    backgroundColor: '#F4F6F9',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  promptQ: {
    fontSize: 13,
    fontWeight: '700',
    color: onboarding.muted,
    marginBottom: 8,
    lineHeight: 18,
  },
  promptA: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: onboarding.text,
    letterSpacing: -0.2,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: '#eee',
  },
});
