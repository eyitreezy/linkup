/**
 * PL4 — plan overview, offers preview, actions, boost & interest (Premium).
 */
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { isPlanSaved, recordPlanView, setPlanSaved } from '@/lib/plans/planEngagement';
import { boostEligibilityFromUser, activatePlanBoost } from '@/lib/premium/boostPlan';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { PlanScreenLoading } from '@/components/plans/PlanScreenLoading';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PlanOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, dbUser, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [offers, setOffers] = useState<DbPlanOffer[]>([]);
  const [gateOpen, setGateOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busyBoost, setBusyBoost] = useState(false);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured) return;
    const { data: p } = await supabase.from('plans').select('*').eq('id', id).single();
    if (p) setPlan(p as DbPlan);
    const { data: o } = await supabase
      .from('plan_offers')
      .select('*')
      .eq('plan_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (o) setOffers(o as DbPlanOffer[]);
    if (user?.id) {
      const s = await isPlanSaved(supabase, id, user.id);
      setSaved(s);
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if (!id || !user?.id || !plan || plan.creator_id === user.id) return;
      void recordPlanView(supabase, id, user.id);
    }, [id, user?.id, plan])
  );

  if (!plan && id) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <PlanStackScreenHeader title="Plan" />
        <PlanScreenLoading title="Loading plan" subtitle="Hang tight — we’re fetching this plan and recent offers." />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <PlanStackScreenHeader title="Plan" />
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>Plan not found</Text>
          <Text style={styles.centerSub}>This plan may have been removed or the link is outdated.</Text>
        </View>
      </Screen>
    );
  }

  const isCreator = plan.creator_id === user?.id;
  const when = formatPlanWhen(plan);
  const price = formatPlanPrice(plan);
  const preview = offers.slice(0, 4);
  const subscriber = isPremiumSubscriber(dbUser);
  const boosted =
    plan.boosted_until != null && new Date(plan.boosted_until).getTime() > Date.now();

  function goNegotiate() {
    if (!isCreator && requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    router.push(`/plan/${id}/negotiate` as Href);
  }

  function goAgreement() {
    router.push(`/plan/${id}/agreement` as Href);
  }

  async function openPlanCounterpartyChat() {
    if (!user || !plan) return;
    const acc = offers.find((o) => o.id === plan.accepted_offer_id);
    if (!acc) {
      Alert.alert('Chat', 'Could not find the accepted offer. Try refreshing this screen.');
      return;
    }
    const other = plan.creator_id === user.id ? acc.bidder_id : plan.creator_id;
    try {
      await openDirectChat(supabase, user.id, other);
    } catch (e) {
      Alert.alert('Chat', e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  async function toggleSave() {
    if (!user?.id || !plan) return;
    if (!subscriber) {
      router.push('/premium' as Href);
      return;
    }
    const next = !saved;
    const { error } = await setPlanSaved(supabase, plan.id, user.id, next);
    if (error) Alert.alert('Save', error);
    else setSaved(next);
  }

  async function onBoost() {
    if (!user?.id || !isCreator) return;
    const { canBoost, premiumSubscriber, credits } = boostEligibilityFromUser(dbUser);
    if (!canBoost) {
      router.push('/premium' as Href);
      return;
    }
    Alert.alert(
      'Boost this plan?',
      'Your plan will be highlighted in the feed for about 2 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Boost',
          onPress: () => void runBoost(premiumSubscriber, credits),
        },
      ]
    );
  }

  async function runBoost(premiumSubscriber: boolean, credits: number) {
    const p = plan;
    if (!user?.id || !p) return;
    setBusyBoost(true);
    const { error } = await activatePlanBoost(supabase, {
      planId: p.id,
      creatorId: user.id,
      boostCredits: credits,
      premiumSubscriber,
    });
    setBusyBoost(false);
    if (error) Alert.alert('Boost', error);
    else {
      await refreshProfile();
      void load();
    }
  }

  const agreed =
    plan.status === 'agreed' ||
    plan.status === 'awaiting_payment' ||
    plan.status === 'active';

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <PlanStackScreenHeader title="Plan" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <VerificationHardGateModal
          visible={gateOpen}
          onClose={() => setGateOpen(false)}
          verificationStatus={dbUser?.verification_status}
        />
        <Card style={styles.hero}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{plan.title}</Text>
          {boosted ? (
            <View style={styles.boostPill}>
              <Text style={styles.boostPillTxt}>Boosted</Text>
            </View>
          ) : null}
        </View>
        {plan.description ? <Text style={styles.desc}>{plan.description}</Text> : null}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>When</Text>
          <Text style={styles.metaVal}>{when}</Text>
        </View>
        {plan.location_label ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Where</Text>
            <Text style={styles.metaVal}>{plan.location_label}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Price</Text>
          <Text style={styles.metaVal}>{price ?? 'Open to offers'}</Text>
        </View>
        <Text style={styles.status}>Status · {plan.status}</Text>
      </Card>

      {isCreator ? (
        <View style={styles.rowBtns}>
          <Button title={busyBoost ? 'Boosting…' : 'Boost plan'} onPress={() => void onBoost()} disabled={busyBoost} />
          {subscriber ? (
            <Button
              title="Who is interested?"
              variant="secondary"
              onPress={() => router.push(`/plan/${id}/interest` as Href)}
            />
          ) : (
            <Button title="Interest (Premium)" variant="ghost" onPress={() => router.push('/premium' as Href)} />
          )}
        </View>
      ) : (
        <Button
          title={saved ? 'Saved' : 'Save plan'}
          variant={saved ? 'secondary' : 'ghost'}
          onPress={() => void toggleSave()}
          style={styles.primaryBtn}
        />
      )}

      {agreed ? (
        <>
          <Button title="View agreement" onPress={goAgreement} style={styles.primaryBtn} />
          {user ? (
            <Button
              title="Message"
              variant="secondary"
              onPress={() => void openPlanCounterpartyChat()}
              style={styles.primaryBtn}
            />
          ) : null}
        </>
      ) : (
        <Button title={isCreator ? 'Manage offers' : 'Make or view offers'} onPress={goNegotiate} style={styles.primaryBtn} />
      )}

      <Text style={styles.section}>Recent offers</Text>
      {preview.length === 0 ? (
        <Text style={styles.muted}>No offers yet.</Text>
      ) : (
        <FlatList
          data={preview}
          scrollEnabled={false}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <Card style={styles.offerCard}>
              <Text style={styles.offerAmt}>
                {item.amount_cents != null
                  ? `${(item.amount_cents / 100).toFixed(0)} ${plan.currency}`
                  : 'Open amount'}{' '}
                · {item.status}
              </Text>
              {item.message ? <Text style={styles.muted}>{item.message}</Text> : null}
            </Card>
          )}
        />
      )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  centerSub: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  hero: { marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, flex: 1 },
  boostPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: colors.secondary,
  },
  boostPillTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  desc: { fontSize: 15, color: colors.textMuted, marginTop: 10, lineHeight: 22 },
  metaRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  metaVal: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
  status: { marginTop: 14, fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'capitalize' },
  primaryBtn: { marginBottom: spacing.sm },
  rowBtns: { gap: spacing.sm, marginBottom: spacing.sm },
  section: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  offerCard: { marginBottom: spacing.sm },
  offerAmt: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted },
});
