/** Validate redirect_url for Flutterwave hosted checkout (mobile deep link or web HTTPS). */
export function resolveFlutterwaveRedirectUrl(
  requested: string | undefined,
  fallback: string
): { url: string } | { error: string } {
  const raw = (requested?.trim() || fallback.trim());
  if (!raw) {
    return { error: 'redirect_url is required' };
  }

  if (/^linkup:\/\//i.test(raw)) {
    return { url: raw };
  }
  if (/^https:\/\//i.test(raw)) {
    return { url: raw };
  }
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(raw)) {
    return { url: raw };
  }

  return {
    error:
      'redirect_url must be linkup://…, https://…, or http://localhost… (web dev).',
  };
}
