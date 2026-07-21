/**
 * Opens shared plan links (https://linkup.app/plan/[id] or linkup://plan/[id]).
 * Runs after auth deep-link handling; does not intercept auth callback URLs.
 */
import { urlLooksLikeAuthRedirect } from '@/lib/authProviders';
import { parsePlanIdFromUrl } from '@/lib/plans/planShareUrl';
import * as Linking from 'expo-linking';
import { useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

function isAuthCallbackPath(segments: string[]): boolean {
  const key = segments.join('/');
  return key.includes('auth/callback') || key === 'auth/callback';
}

function planIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (urlLooksLikeAuthRedirect(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  if (lower.includes('auth/callback')) return null;
  return parsePlanIdFromUrl(trimmed);
}

export function PlanDeepLinkBootstrap() {
  const router = useRouter();
  const segments = useSegments();
  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    function routePlan(url: string | null) {
      if (!url?.trim()) return;
      const planId = planIdFromUrl(url);
      if (!planId) return;
      if (lastHandledRef.current === `${planId}:${url}`) return;
      lastHandledRef.current = `${planId}:${url}`;

      const href = `/plan/${planId}` as Href;
      const onPlanDetail = segments.join('/').includes(`plan/${planId}`);
      if (onPlanDetail) return;

      router.push(href);
    }

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isAuthCallbackPath([...segments])) return;
      routePlan(url);
    });

    return () => sub.remove();
  }, [router, segments]);

  return null;
}
