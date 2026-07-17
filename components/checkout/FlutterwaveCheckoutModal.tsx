/**
 * In-app Flutterwave checkout — full-width WebView tuned for 320px+ phones.
 * On Android preview/production builds, prefer Chrome Custom Tab via useFlutterwaveCheckout.
 */
import { colors, spacing, fonts } from '@/constants/theme';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

type Props = {
  visible: boolean;
  url: string | null;
  returnUrl: string | null;
  onDismiss: () => void;
  onSuccess?: (returnUrl: string) => void;
  title?: string;
};

const CONTENT_PROBE_DELAY_MS = 4_500;
const BLANK_FALLBACK_MS = 45_000;

function matchesReturnUrl(target: string, returnUrl: string): boolean {
  const t = target.trim().toLowerCase();
  const r = returnUrl.trim().toLowerCase();
  if (!t || !r) return false;
  return t === r || t.startsWith(`${r}?`) || t.startsWith(`${r}#`);
}

export function FlutterwaveCheckoutModal({
  visible,
  url,
  returnUrl,
  onDismiss,
  onSuccess,
  title = 'Secure checkout',
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [browserBusy, setBrowserBusy] = useState(false);
  const completedRef = useRef(false);
  const blankTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentProbeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentReadyRef = useRef(false);
  const autoBrowserAttemptedRef = useRef(false);
  const checkoutEngagedRef = useRef(false);
  const initialUrlRef = useRef<string | null>(null);

  const clearBlankTimer = useCallback(() => {
    if (blankTimerRef.current) {
      clearTimeout(blankTimerRef.current);
      blankTimerRef.current = null;
    }
  }, []);

  const clearContentProbeTimer = useCallback(() => {
    if (contentProbeTimerRef.current) {
      clearTimeout(contentProbeTimerRef.current);
      contentProbeTimerRef.current = null;
    }
  }, []);

  const markContentReady = useCallback(() => {
    contentReadyRef.current = true;
    clearBlankTimer();
    clearContentProbeTimer();
    setLoading(false);
    setLoadError(null);
  }, [clearBlankTimer, clearContentProbeTimer]);

  const handleReturn = useCallback(
    (target: string) => {
      if (!returnUrl || completedRef.current) return false;
      if (!matchesReturnUrl(target, returnUrl)) return false;
      completedRef.current = true;
      onSuccess?.(target);
      onDismiss();
      return true;
    },
    [onDismiss, onSuccess, returnUrl]
  );

  const onNavigationChange = useCallback(
    (nav: WebViewNavigation) => {
      if (nav.url && nav.url !== initialUrlRef.current) {
        checkoutEngagedRef.current = true;
        markContentReady();
      }
      handleReturn(nav.url);
    },
    [handleReturn, markContentReady]
  );

  const resetState = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setBrowserBusy(false);
    completedRef.current = false;
    contentReadyRef.current = false;
    autoBrowserAttemptedRef.current = false;
    checkoutEngagedRef.current = false;
    initialUrlRef.current = url;
    clearBlankTimer();
    clearContentProbeTimer();
  }, [clearBlankTimer, clearContentProbeTimer, url]);

  const openInBrowser = useCallback(async () => {
    if (!url || !returnUrl || browserBusy) return;
    setBrowserBusy(true);
    try {
      const result = await openFlutterwaveCheckoutInBrowser(url, returnUrl);
      if (result.ok) {
        completedRef.current = true;
        onSuccess?.(returnUrl);
        onDismiss();
      } else {
        setLoadError(result.error ?? 'Could not open checkout in browser.');
        setLoading(false);
      }
    } finally {
      setBrowserBusy(false);
    }
  }, [browserBusy, onDismiss, onSuccess, returnUrl, url]);

  const scheduleBlankFallback = useCallback(() => {
    if (checkoutEngagedRef.current || contentReadyRef.current) return;
    clearBlankTimer();
    blankTimerRef.current = setTimeout(() => {
      if (completedRef.current || contentReadyRef.current || checkoutEngagedRef.current) return;
      if (!autoBrowserAttemptedRef.current && url && returnUrl) {
        autoBrowserAttemptedRef.current = true;
        void openInBrowser();
        return;
      }
      setLoading(false);
      setLoadError(
        'Checkout did not load in the app. Continue in your browser for a secure payment experience.'
      );
    }, BLANK_FALLBACK_MS);
  }, [clearBlankTimer, openInBrowser, returnUrl, url]);

  const onWebViewMessage = useCallback(
    (raw: string) => {
      const msg = parseFlutterwaveContentProbe(raw);
      if (!msg || msg.ok !== true) return;
      markContentReady();
    },
    [markContentReady]
  );

  useEffect(() => {
    if (!visible || !url) return;
    resetState();
    scheduleBlankFallback();
    clearContentProbeTimer();
    contentProbeTimerRef.current = setTimeout(() => {
      if (!contentReadyRef.current && !completedRef.current && !checkoutEngagedRef.current) {
        scheduleBlankFallback();
      }
    }, CONTENT_PROBE_DELAY_MS);
    return () => {
      clearBlankTimer();
      clearContentProbeTimer();
    };
  }, [visible, url, scheduleBlankFallback, clearBlankTimer, clearContentProbeTimer, resetState]);

  if (!visible || !url) return null;

  const minWidth = Math.max(320, Math.min(width, 480));
  const injectedJavaScript = `${FLUTTERWAVE_CHECKOUT_VIEWPORT_JS}\n${FLUTTERWAVE_CONTENT_PROBE_JS}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onDismiss}
    >
      <View style={[styles.shell, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Ionicons name="lock-closed" size={16} color={colors.primary} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closePressed]}
            accessibilityRole="button"
            accessibilityLabel="Close checkout"
          >
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </View>

        <View style={[styles.webWrap, { width: '100%', minWidth }]}>
          {loadError ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorTitle}>Could not load checkout</Text>
              <Text style={styles.errorBody}>{loadError}</Text>
              <Pressable
                onPress={() => void openInBrowser()}
                disabled={browserBusy}
                style={[styles.errorCta, browserBusy && { opacity: 0.65 }]}
              >
                {browserBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.errorCtaTxt}>Continue in browser</Text>
                )}
              </Pressable>
              <Pressable onPress={onDismiss} style={styles.errorGhost}>
                <Text style={styles.errorGhostTxt}>Go back</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {loading ? (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator color={colors.primary} size="large" />
                  <Text style={styles.loadingTxt}>Loading secure payment…</Text>
                </View>
              ) : null}
              <WebView
                key={url}
                source={{ uri: url }}
                style={styles.webview}
                containerStyle={styles.webviewContainer}
                userAgent={FLUTTERWAVE_CHECKOUT_USER_AGENT}
                onLoadStart={() => {
                  if (!checkoutEngagedRef.current && !contentReadyRef.current) {
                    setLoading(true);
                  }
                }}
                onLoadEnd={(event) => {
                  if (checkoutEngagedRef.current || contentReadyRef.current) {
                    markContentReady();
                    return;
                  }
                  if (!isFlutterwaveCheckoutPageUrl(event.nativeEvent.url)) return;
                  scheduleBlankFallback();
                }}
                onError={() => {
                  setLoading(false);
                  setLoadError('Check your connection and try again, or continue in your browser.');
                }}
                onHttpError={() => {
                  setLoading(false);
                  setLoadError('Checkout page could not be reached. Try again or use your browser.');
                }}
                onNavigationStateChange={onNavigationChange}
                onShouldStartLoadWithRequest={(req) => {
                  if (handleReturn(req.url)) return false;
                  return true;
                }}
                onMessage={(event) => onWebViewMessage(event.nativeEvent.data)}
                injectedJavaScript={injectedJavaScript}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                setSupportMultipleWindows={Platform.OS === 'android'}
                allowsBackForwardNavigationGestures
                startInLoadingState={false}
                scalesPageToFit={Platform.OS === 'android'}
                textZoom={100}
                originWhitelist={['https://*', 'http://*', 'linkup://*']}
                allowsInlineMediaPlayback
                cacheEnabled
                mixedContentMode="always"
                onRenderProcessGone={() => {
                  setLoading(false);
                  setLoadError('Checkout crashed in the app. Continue in your browser instead.');
                }}
              />
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
          <Text style={styles.footerTxt}>Payments secured by Flutterwave</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    flex: 1,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
  },
  closePressed: { opacity: 0.88 },
  closeTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  webWrap: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.surface,
  },
  webviewContainer: {
    flex: 1,
    width: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    zIndex: 2,
  },
  loadingTxt: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorCta: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary,
    minWidth: 200,
    alignItems: 'center',
  },
  errorCtaTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  errorGhost: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorGhostTxt: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerTxt: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
});

