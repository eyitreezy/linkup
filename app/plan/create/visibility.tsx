/**
 * PL2 — Bumble-style visibility before publish.
 */
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { VisibilityPickCard } from '@/components/plans/create/VisibilityPickCard';
import { colors, spacing } from '@/constants/theme';
import { usePlanDraft, type PlanVisibility } from '@/contexts/PlanDraftContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

const OPTIONS: {
  value: PlanVisibility;
  title: string;
  description: string;
  icon: 'globe-outline' | 'navigate-outline' | 'people-outline';
}[] = [
  {
    value: 'public',
    title: 'Public',
    description: 'Anyone on LinkUp can discover this plan in the feed.',
    icon: 'globe-outline',
  },
  {
    value: 'radius',
    title: 'Within radius',
    description: 'Shown to people roughly within your discovery radius.',
    icon: 'navigate-outline',
  },
  {
    value: 'friends',
    title: 'Friends only',
    description: 'Only your connections see this (once friends ship, this tightens automatically).',
    icon: 'people-outline',
  },
];

export default function CreatePlanVisibilityScreen() {
  const { draft, setDraft, reset } = usePlanDraft();
  const { user, dbUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  async function publish() {
    if (!user || !isSupabaseConfigured) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (!draft.title.trim() || !draft.scheduledAt) {
      Alert.alert('Almost there', 'Go back and add a title and time.');
      return;
    }
    setLoading(true);
    const startingCents = draft.startingPrice.trim()
      ? Math.round(Number(draft.startingPrice) * 100)
      : null;
    const { data, error } = await supabase
      .from('plans')
      .insert({
        creator_id: user.id,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        starting_price_cents: startingCents,
        currency: 'NGN',
        status: 'negotiating',
        visibility: draft.visibility,
        scheduled_at: draft.scheduledAt.toISOString(),
        location_label: draft.locationLabel.trim() || null,
        latitude: draft.latitude,
        longitude: draft.longitude,
      })
      .select('id')
      .single();

    setLoading(false);
    if (error) {
      Alert.alert('Could not publish', error.message);
      return;
    }
    reset();
    router.replace({ pathname: '/plan/create/success', params: { planId: String(data.id) } } as Href);
  }

  return (
    <Screen scroll>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
      />
      <Text style={styles.lead}>Who should see this?</Text>
      <Text style={styles.sub}>Pick one. You can always create another plan with different visibility.</Text>
      <View style={styles.list}>
        {OPTIONS.map((opt) => (
          <VisibilityPickCard
            key={opt.value}
            title={opt.title}
            description={opt.description}
            icon={opt.icon}
            selected={draft.visibility === opt.value}
            onPress={() => setDraft((d) => ({ ...d, visibility: opt.value }))}
          />
        ))}
      </View>
      <Button title="Publish plan" onPress={() => void publish()} loading={loading} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 22, fontWeight: '800', color: colors.text, marginHorizontal: spacing.md, marginBottom: 8 },
  sub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  list: { marginTop: spacing.sm },
  cta: { marginHorizontal: spacing.md, marginTop: spacing.md },
});
