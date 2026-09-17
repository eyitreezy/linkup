import { MatchMakerGateScreen } from '@/components/matchmaker/MatchMakerGateScreen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { MM } from '@/constants/matchmakerTheme';
import { useMatchMakerGate } from '@/hooks/useMatchMakerGate';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

export default function MatchMakerRootScreen() {
  const { state, loading, route } = useMatchMakerGate();
  const { dbUser } = useAuth();
  const [kycOpen, setKycOpen] = useState(false);

  useEffect(() => {
    if (loading || !state) return;
    if (state.gate === 'subscription' || state.gate === 'kyc') return;
    if (route !== '/matchmaker') {
      router.replace(route as Href);
    }
  }, [loading, state, route]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: MM.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  if (state?.gate === 'subscription') {
    const tier = resolveClientEffectiveTier(dbUser);
    const hasGold = tier === 'GOLD' || tier === 'PLATINUM';
    if (hasGold) {
      return (
        <View style={{ flex: 1, backgroundColor: MM.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={MM.accent} />
        </View>
      );
    }
    return (
      <MatchMakerGateScreen
        title="MatchMaker is a Gold feature"
        body="Upgrade your LinkUp subscription to access intentional matchmaking designed for people serious about a long-term relationship."
        primaryLabel="Upgrade to Gold"
        onPrimary={() => router.push('/subscription' as Href)}
        secondaryLabel="Learn more about Gold"
        onSecondary={() => router.push('/subscription' as Href)}
        onBack={() => router.back()}
      />
    );
  }

  if (state?.gate === 'kyc') {
    return (
      <>
        <MatchMakerGateScreen
          title="Verify your identity first"
          body="MatchMaker is built on trust. We verify every member before they enter the pool to protect you and everyone else."
          primaryLabel="Complete verification"
          onPrimary={() => setKycOpen(true)}
          secondaryLabel="Why is this required?"
          onSecondary={() => setKycOpen(true)}
          onBack={() => router.back()}
        />
        <VerificationHardGateModal
          visible={kycOpen}
          onClose={() => setKycOpen(false)}
          verificationStatus={dbUser?.verification_status}
          title="Verification required"
          message="Complete identity verification to enter MatchMaker."
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: MM.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={MM.accent} />
    </View>
  );
}
