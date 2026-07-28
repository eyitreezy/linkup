import { LiveLocationConsentModal } from '@/components/plans/LiveLocationConsentModal';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  planId: string;
  currentUserId: string;
};

type ActiveSession = { id: string; expiresAt: string };

export function LiveLocationButton({ planId, currentUserId }: Props) {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void supabase
      .from('live_location_consents')
      .select('id')
      .eq('user_id', currentUserId)
      .maybeSingle()
      .then(({ data }) => setHasConsent(!!data));

    void supabase
      .from('live_location_sessions')
      .select('id, expires_at')
      .eq('plan_id', planId)
      .eq('sharer_id', currentUserId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveSession({ id: data.id, expiresAt: data.expires_at });
          startPinging(data.id);
        }
      });

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [planId, currentUserId]);

  const startPinging = (sessionId: string) => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      void pingLocation(sessionId);
    }, 8000);
  };

  const pingLocation = async (sessionId: string) => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ping-live-location`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        }),
      }
    );

    if (res.status === 410) {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      setActiveSession(null);
    }
  };

  const handleStartSharing = async (durationMinutes: number) => {
    setIsLoading(true);
    setShowPicker(false);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setIsLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/start-live-location`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan_id: planId, duration_minutes: durationMinutes }),
      }
    );
    const data = (await res.json()) as { session_id?: string; expires_at?: string };
    if (data.session_id && data.expires_at) {
      setActiveSession({ id: data.session_id, expiresAt: data.expires_at });
      startPinging(data.session_id);
    }
    setIsLoading(false);
  };

  const handleStopSharing = async () => {
    if (!activeSession) return;
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stop-live-location`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ session_id: activeSession.id }),
        }
      );
    }
    setActiveSession(null);
  };

  const handlePress = () => {
    if (hasConsent === null || isLoading) return;
    if (!hasConsent) {
      setShowConsentModal(true);
      return;
    }
    if (activeSession) {
      void handleStopSharing();
      return;
    }
    setShowPicker(true);
  };

  return (
    <View style={styles.container}>
      <LiveLocationConsentModal
        visible={showConsentModal}
        onConsented={() => {
          setHasConsent(true);
          setShowConsentModal(false);
          setShowPicker(true);
        }}
        onDeclined={() => setShowConsentModal(false)}
      />

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Share location for how long?</Text>
            {[
              { label: '15 minutes', value: 15 },
              { label: '1 hour', value: 60 },
              { label: 'Until I stop', value: -1 },
            ].map((opt) => (
              <Pressable
                key={opt.value}
                style={styles.pickerOption}
                onPress={() => void handleStartSharing(opt.value)}
              >
                <Text style={styles.pickerOptionLabel}>{opt.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.pickerCancel} onPress={() => setShowPicker(false)}>
              <Text style={styles.pickerCancelLabel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Pressable
        style={[styles.buttonOuter, activeSession && styles.buttonActiveOuter]}
        onPress={handlePress}
        disabled={isLoading || hasConsent === null}
      >
        <LinearGradient
          colors={
            activeSession
              ? ['#059669', '#10B981']
              : isLoading
                ? [colors.border, colors.border]
                : [colors.primary, '#8B7CF8']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="navigate" size={16} color="#fff" />
              <Text style={styles.buttonLabel}>
                {activeSession ? 'Sharing location' : 'Share location'}
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  buttonOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  buttonActiveOuter: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    width: '100%',
    maxWidth: 340,
    gap: spacing.xs,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  pickerOption: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pickerOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  pickerCancel: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  pickerCancelLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
});
