import {
  MatchMakerGateModal,
  type MatchMakerGateState as MatchMakerGateModalState,
} from '@/components/matchmaker/MatchMakerGateModal';
import { MatchMakerPool } from '@/components/matchmaker/MatchMakerPool';
import { MatchMakerPoolPreview } from '@/components/matchmaker/MatchMakerPoolPreview';
import { MatchMakerSkeleton } from '@/components/matchmaker/MatchMakerSkeleton';
import { MM } from '@/constants/matchmakerTheme';
import { fonts, spacing } from '@/constants/theme';
import {
  daysUntilGate,
  fetchMatchMakerGateState,
  gateRouteFor,
  MATCHMAKER_GATED_MODAL,
} from '@/lib/matchmaker/gates';
import { fetchMatchMakerPoolPreview } from '@/lib/matchmaker/pool';
import type { MatchMakerGate, MatchMakerPoolProfile } from '@/lib/matchmaker/types';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenGate = MatchMakerGate | 'loading';

export default function MatchMakerRootScreen() {
  const insets = useSafeAreaInsets();
  const [gateState, setGateState] = useState<ScreenGate>('loading');
  const [gateMeta, setGateMeta] = useState<{
    cooldownUntil?: string;
    suspensionUntil?: string;
    connectionId?: string;
  }>({});
  const [modalDismissed, setModalDismissed] = useState(false);
  const [poolPreview, setPoolPreview] = useState<MatchMakerPoolProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkGate = useCallback(async () => {
    setGateState('loading');
    setModalDismissed(false);
    setError(null);

    try {
      const data = await fetchMatchMakerGateState();
      setGateState(data.gate);
      setGateMeta({
        cooldownUntil: data.cooldown_until,
        suspensionUntil: data.suspension_until,
        connectionId: data.connection_id,
      });

      const redirect = gateRouteFor(data);
      if (redirect) {
        router.replace(redirect as Href);
        return;
      }

      if (MATCHMAKER_GATED_MODAL.includes(data.gate)) {
        try {
          const preview = await fetchMatchMakerPoolPreview(6);
          setPoolPreview(preview);
        } catch {
          setPoolPreview([]);
        }
      } else {
        setPoolPreview([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load MatchMaker');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void checkGate();
    }, [checkGate])
  );

  const isGated = MATCHMAKER_GATED_MODAL.includes(gateState as MatchMakerGate);
  const gateModal = gateState as MatchMakerGateModalState;

  if (gateState === 'loading') {
    return <MatchMakerSkeleton />;
  }

  if (error) {
    return (
      <View style={[styles.errorRoot, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (
    gateState === 'connection' ||
    gateState === 'intent' ||
    gateState === 'values' ||
    gateState === 'reflection' ||
    gateState === 'healing' ||
    gateState === 'reentry'
  ) {
    return (
      <View style={[styles.errorRoot, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: MM.bg }}>
      <View style={{ flex: 1 }} pointerEvents={isGated ? 'none' : 'auto'}>
        {isGated ? <MatchMakerPoolPreview profiles={poolPreview} /> : <MatchMakerPool />}
      </View>

      {isGated ? (
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}

      {isGated && modalDismissed ? (
        <View style={[styles.persistentBanner, { paddingTop: insets.top + 10 }]}>
          <Ionicons name="time-outline" size={16} color="#92400E" />
          <Text style={styles.persistentBannerText}>
            {gateState === 'cooldown'
              ? `MatchMaker resumes in ${daysUntilGate(gateMeta.cooldownUntil)} days`
              : gateState === 'suspended'
                ? `MatchMaker suspended, ${daysUntilGate(gateMeta.suspensionUntil)} days remaining`
                : gateState === 'subscription'
                  ? 'Upgrade to Gold to access MatchMaker'
                  : 'Complete verification to access MatchMaker'}
          </Text>
        </View>
      ) : null}

      {isGated ? (
        <MatchMakerGateModal
          visible={!modalDismissed}
          gate={gateModal}
          cooldownDaysRemaining={daysUntilGate(gateMeta.cooldownUntil)}
          cooldownUntil={gateMeta.cooldownUntil}
          suspensionDaysRemaining={daysUntilGate(gateMeta.suspensionUntil)}
          onDismiss={() => setModalDismissed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  errorRoot: {
    flex: 1,
    backgroundColor: MM.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  persistentBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    zIndex: 2,
  },
  persistentBannerText: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#92400E',
  },
});
