import { planPreviewShareUrl } from '@/lib/plans/planShareUrl';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useCallback, useRef, type RefObject } from 'react';
import { Alert, Platform, Share } from 'react-native';
import ViewShot from 'react-native-view-shot';

export type PlanShareChannel =
  | 'whatsapp'
  | 'copy_link'
  | 'native'
  | 'twitter'
  | 'instagram'
  | 'facebook';

export type PlanShareParams = {
  planId: string;
  planTitle?: string | null;
  meetTypeName: string;
  city: string;
  currentUserId?: string | null;
};

export type PlanShareContent = {
  previewUrl: string;
  shareText: string;
  message: string;
};

export function buildPlanShareContent(params: PlanShareParams): PlanShareContent {
  const previewUrl = planPreviewShareUrl(params.planId);
  const shareText = `Join ${params.meetTypeName} in ${params.city} on LinkUp`;
  const message = `${shareText}\n\n${previewUrl}`;
  return { previewUrl, shareText, message };
}

async function captureShareCardImage(
  cardRef: RefObject<ViewShot | null>
): Promise<string | undefined> {
  if (!cardRef.current?.capture) return undefined;
  try {
    return await cardRef.current.capture();
  } catch (captureErr) {
    console.warn('[share] card capture failed', captureErr);
    return undefined;
  }
}

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
    const { message, shareText } = buildPlanShareContent(params);

    try {
      const imageUri = await captureShareCardImage(cardRef);

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
        Alert.alert('Could not share', 'Please try again or copy the link below.');
      }
    }
  }, [params, recordShare]);

  const copyLink = useCallback(async () => {
    const { previewUrl } = buildPlanShareContent(params);
    try {
      await Clipboard.setStringAsync(previewUrl);
      await recordShare('copy_link');
      return true;
    } catch {
      return false;
    }
  }, [params, recordShare]);

  const shareToWhatsApp = useCallback(async () => {
    const { message } = buildPlanShareContent(params);
    const waUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
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

  const shareToTwitter = useCallback(async () => {
    const { previewUrl, shareText } = buildPlanShareContent(params);
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(previewUrl)}`;
    try {
      await Linking.openURL(intentUrl);
      await recordShare('twitter');
    } catch {
      try {
        await sharePlan();
      } catch {
        Alert.alert('Could not open X', 'Try copy link or more options below.');
      }
    }
  }, [params, recordShare, sharePlan]);

  const shareToFacebook = useCallback(async () => {
    const { previewUrl } = buildPlanShareContent(params);
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(previewUrl)}`;
    try {
      await Linking.openURL(fbShareUrl);
      await recordShare('facebook');
    } catch {
      const copied = await copyLink();
      if (copied) {
        Alert.alert(
          'Link copied',
          'We could not open Facebook. Paste the copied link in Facebook to share this plan.'
        );
      } else {
        Alert.alert('Could not share', 'Try copy link or more options below.');
      }
    }
  }, [copyLink, params, recordShare]);

  /**
   * Instagram has no supported public URL scheme for link posts.
   * Share the plan card image via the native sheet (Instagram Stories/DM) and copy the link.
   */
  const shareToInstagram = useCallback(async () => {
    const { previewUrl, message, shareText } = buildPlanShareContent(params);

    try {
      await Clipboard.setStringAsync(previewUrl);
    } catch {
      // Continue — native share may still work
    }

    try {
      const imageUri = await captureShareCardImage(cardRef);

      if (imageUri) {
        const shareOptions =
          Platform.OS === 'ios'
            ? { url: imageUri, message: shareText }
            : { message: `${message}`, url: imageUri };

        const result = await Share.share(shareOptions);
        if (result.action === Share.sharedAction) {
          await recordShare('instagram');
        }
        return;
      }

      const textResult = await Share.share({
        title: params.planTitle ?? shareText,
        message,
      });
      if (textResult.action === Share.sharedAction) {
        await recordShare('instagram');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'User did not share') return;

      Alert.alert(
        'Share on Instagram',
        'Your plan link was copied. Open Instagram and paste it in a story, post, or DM.',
        [
          {
            text: 'Open Instagram',
            onPress: () => {
              void Linking.openURL('instagram://app').catch(() => {
                Alert.alert('Instagram unavailable', 'Use copy link below.');
              });
            },
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }
  }, [params, recordShare]);

  return {
    cardRef,
    sharePlan,
    copyLink,
    shareToWhatsApp,
    shareToTwitter,
    shareToFacebook,
    shareToInstagram,
  };
}
