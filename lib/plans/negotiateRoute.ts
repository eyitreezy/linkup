import type { Href } from 'expo-router';

export function planNegotiateHref(
  planId: string,
  opts?: { offerId?: string; action?: 'counter' }
): Href {
  const params = new URLSearchParams();
  if (opts?.offerId) params.set('offerId', opts.offerId);
  if (opts?.action) params.set('action', opts.action);
  const q = params.toString();
  return (q ? `/plan/${planId}/negotiate?${q}` : `/plan/${planId}/negotiate`) as Href;
}
