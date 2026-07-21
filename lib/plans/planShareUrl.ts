import Constants from 'expo-constants';

const PLAN_ID_RE =
  /\/plan\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;

export function appPublicBaseUrl(): string {
  const raw =
    process.env.EXPO_PUBLIC_APP_URL ??
    process.env.EXPO_PUBLIC_URL ??
    extra?.appUrl ??
    'https://linkup.app';
  return raw.replace(/\/$/, '');
}

export function planPreviewShareUrl(planId: string): string {
  return `${appPublicBaseUrl()}/plan/${planId}/preview`;
}

/** Extract plan id from https or linkup:// plan links. */
export function parsePlanIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(PLAN_ID_RE);
  return match?.[1] ?? null;
}
