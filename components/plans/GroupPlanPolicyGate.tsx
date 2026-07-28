import { colors, radius, spacing, fonts } from '@/constants/theme';
import { GROUP_PLAN_POLICY_SECTIONS } from '@/lib/plans/policySignOffContent';
import { GROUP_PLAN_POLICY_VERSION, hasGroupPlanPolicySignoff } from '@/lib/plans/groupPlanAnnexure';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  userId: string;
  children: React.ReactNode;
};

export function GroupPlanPolicyGate({ userId, children }: Props) {
  const [loading, setLoading] = useState(true);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (!userId) {
      setSigned(true);
      setLoading(false);
      return;
    }
    let cancel = false;
    void (async () => {
      const ok = await hasGroupPlanPolicySignoff(userId);
      if (!cancel) {
        setSigned(ok);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userId]);

  const handleSign = async () => {
    if (!hasScrolled) return;
    setSigning(true);
    try {
      await supabase.from('group_plan_policy_signoffs').upsert(
        { user_id: userId, policy_version: GROUP_PLAN_POLICY_VERSION },
        { onConflict: 'user_id,policy_version', ignoreDuplicates: true }
      );
      setSigned(true);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (signed) return <>{children}</>;

  return (
    <>
      {children}
      <Modal visible transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Before you join or create a Group Plan</Text>
            <Text style={styles.subtitle}>Group Plan Rules</Text>
            <ScrollView
              style={styles.scroll}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
                  setHasScrolled(true);
                }
              }}
              scrollEventThrottle={200}
            >
              {GROUP_PLAN_POLICY_SECTIONS.map((section) => (
                <View key={section.heading} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.heading}</Text>
                  {section.paragraphs.map((p) => (
                    <Text key={p} style={styles.point}>
                      {p}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={[styles.buttonOuter, (!hasScrolled || signing) && styles.buttonDisabled]}
              onPress={handleSign}
              disabled={!hasScrolled || signing}
            >
              <LinearGradient
                colors={[colors.primary, '#8B7CF8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {signing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonLabel}>I have read and I agree</Text>
                )}
              </LinearGradient>
            </Pressable>
            {!hasScrolled ? (
              <Text style={styles.scrollPrompt}>Scroll to read before agreeing</Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  scroll: { maxHeight: 400 },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  point: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fonts.medium,
    marginBottom: spacing.xs,
  },
  scrollPrompt: {
    fontSize: 12,
    color: colors.secondary,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: fonts.medium,
  },
  buttonOuter: { borderRadius: 50, overflow: 'hidden', marginTop: spacing.sm },
  buttonDisabled: { opacity: 0.5 },
  buttonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
