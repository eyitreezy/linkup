import { planPreviewShareUrl } from '@/lib/plans/planShareUrl';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useCallback, useRef } from 'react';
import { Alert, Platform, Share } from 'react-native';
import ViewShot from 'react-native-view-shot';

export type PlanShareChannel = 'whatsapp' | 'copy_link' | 'native' | 'twitter' | 'instagram';

export type PlanShareParams = {
  planId: string;
  planTitle?: string | null;
  meetTypeName: string;
  city: string;
  currentUserId?: string | null;
};

export function usePlanShare(params: PlanShareParams) {
  const cardRef = useRef<ViewShot>(null);

  const recordShare = useCallback(
    async (channel: PlanShareChannel) => {
      if (!isSupabaseConfigured) return;
      try {
        await supabase.from('plan_shares').insert({
          plan_id: params.planId,
          shared_by_user_id: params.currentUserId ?? null,
          channel,
        });
      } catch {
        // Non-critical — never block sharing
      }
    },
    [params.currentUserId, params.planId]
  );

  const sharePlan = useCallback(async () => {
    const previewUrl = planPreviewShareUrl(params.planId);
    const shareText = `Join ${params.meetTypeName} in ${params.city} on LinkUp`;
    const message = `${shareText}\n\n${previewUrl}`;

    try {
      let imageUri: string | undefined;
      if (cardRef.current?.capture) {
        try {
          imageUri = await cardRef.current.capture();
        } catch (captureErr) {
          console.warn('[share] card capture failed, sharing without image', captureErr);
        }
      }

      const shareOptions =
        imageUri && Platform.OS === 'ios'
          ? {
              title: params.planTitle ?? shareText,
              message,
              url: imageUri,
            }
          : imageUri && Platform.OS === 'android'
            ? {
                title: params.planTitle ?? shareText,
                message,
                url: imageUri,
              }
            : {
                title: params.planTitle ?? shareText,
                message,
              };

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        await recordShare('native');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg !== 'User did not share') {
        Alert.alert('Could not share', 'Please try again.');
      }
    }
  }, [params, recordShare]);

  const copyLink = useCallback(async () => {
    const previewUrl = planPreviewShareUrl(params.planId);
    try {
      await Clipboard.setStringAsync(previewUrl);
      await recordShare('copy_link');
      return true;
    } catch {
      return false;
    }
  }, [params.planId, recordShare]);

  const shareToWhatsApp = useCallback(async () => {
    const previewUrl = planPreviewShareUrl(params.planId);
    const text = `Join ${params.meetTypeName} in ${params.city} on LinkUp\n\n${previewUrl}`;
    const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
        await recordShare('whatsapp');
      } else {
        await sharePlan();
      }
    } catch {
      await sharePlan();
    }
  }, [params, recordShare, sharePlan]);

  return { cardRef, sharePlan, copyLink, shareToWhatsApp };
}
