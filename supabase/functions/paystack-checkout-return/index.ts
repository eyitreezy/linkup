/**
 * HTTPS bridge after Paystack payment → 302 to linkup:// or web success URL.
 * Paystack appends ?reference= & ?trxref= — forwarded to the redirect target.
 *
 * Deploy: npx supabase functions deploy paystack-checkout-return --no-verify-jwt
 */
import { corsHeaders, handleCors } from '../_shared/http.ts';

function buildReturnTarget(reqUrl: URL): string | null {
  const redirectParam = reqUrl.searchParams.get('redirect')?.trim() ?? 'linkup://premium/success';
  if (!/^(linkup|https?):\/\//i.test(redirectParam)) return null;

  let target = redirectParam;
  const q: string[] = [];
  for (const key of ['reference', 'trxref']) {
    const v = reqUrl.searchParams.get(key);
    if (v) q.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  if (q.length > 0) {
    target += (target.includes('?') ? '&' : '?') + q.join('&');
  }
  return target;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const reqUrl = new URL(req.url);
  const target = buildReturnTarget(reqUrl);

  if (!target) {
    return new Response('Invalid redirect', { status: 400, headers: corsHeaders });
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: target,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
});
