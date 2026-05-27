import * as Linking from 'expo-linking';

export type ParsedAuthRedirect = {
  code: string | null;
  token_hash: string | null;
  type: string | null;
  access_token: string | null;
  refresh_token: string | null;
  error: string | null;
  error_description: string | null;
};

function queryParam(value: string | string[] | undefined | null): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function fromSearchParams(sp: URLSearchParams): Partial<ParsedAuthRedirect> {
  return {
    code: sp.get('code'),
    token_hash: sp.get('token_hash'),
    type: sp.get('type'),
    access_token: sp.get('access_token'),
    refresh_token: sp.get('refresh_token'),
    error: sp.get('error'),
    error_description: sp.get('error_description'),
  };
}

/** Parse auth tokens from query, hash, or custom scheme URLs (email confirm / OAuth). */
export function parseAuthRedirectUrl(url: string): ParsedAuthRedirect {
  const trimmed = url.trim();
  const empty: ParsedAuthRedirect = {
    code: null,
    token_hash: null,
    type: null,
    access_token: null,
    refresh_token: null,
    error: null,
    error_description: null,
  };
  if (!trimmed) return empty;

  const parsed = Linking.parse(trimmed);
  const q = parsed.queryParams ?? {};
  let out: ParsedAuthRedirect = {
    code: queryParam(q.code as string | string[] | undefined),
    token_hash: queryParam(q.token_hash as string | string[] | undefined),
    type: queryParam(q.type as string | string[] | undefined),
    access_token: queryParam(q.access_token as string | string[] | undefined),
    refresh_token: queryParam(q.refresh_token as string | string[] | undefined),
    error: queryParam(q.error as string | string[] | undefined),
    error_description: queryParam(q.error_description as string | string[] | undefined),
  };

  const hashPart = trimmed.split('#')[1];
  if (hashPart) {
    const hp = fromSearchParams(new URLSearchParams(hashPart));
    out = {
      code: out.code ?? hp.code ?? null,
      token_hash: out.token_hash ?? hp.token_hash ?? null,
      type: out.type ?? hp.type ?? null,
      access_token: out.access_token ?? hp.access_token ?? null,
      refresh_token: out.refresh_token ?? hp.refresh_token ?? null,
      error: out.error ?? hp.error ?? null,
      error_description: out.error_description ?? hp.error_description ?? null,
    };
  }

  try {
    const normalized = trimmed.replace(/^([^:]+):\/\//, 'https://');
    const u = new URL(normalized);
    const sp = u.searchParams;
    out = {
      code: out.code ?? sp.get('code'),
      token_hash: out.token_hash ?? sp.get('token_hash'),
      type: out.type ?? sp.get('type'),
      access_token: out.access_token ?? sp.get('access_token'),
      refresh_token: out.refresh_token ?? sp.get('refresh_token'),
      error: out.error ?? sp.get('error'),
      error_description: out.error_description ?? sp.get('error_description'),
    };
  } catch {
    /* custom scheme — Linking.parse + hash are primary */
  }

  return out;
}
