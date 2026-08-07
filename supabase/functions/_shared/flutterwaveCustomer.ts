/** Build Flutterwave customer payload with a splittable full name for card checkout prefill. */
export function resolveFlutterwaveCustomer(args: {
  email: string;
  displayName?: string | null;
  authMetadata?: Record<string, unknown> | null;
}): { email: string; name: string } {
  const meta = args.authMetadata ?? {};
  const metaName =
    typeof meta.display_name === 'string'
      ? meta.display_name
      : typeof meta.full_name === 'string'
        ? meta.full_name
        : typeof meta.name === 'string'
          ? meta.name
          : null;

  const fallback = args.email.split('@')[0]?.trim() || 'LinkUp User';
  const raw = (args.displayName?.trim() || metaName?.trim() || fallback).replace(/\s+/g, ' ');
  const parts = raw.split(' ').filter(Boolean);
  const first = parts[0] ?? 'LinkUp';
  const last = parts.length > 1 ? parts.slice(1).join(' ') : 'Member';

  return {
    email: args.email,
    name: `${first} ${last}`.trim(),
  };
}
