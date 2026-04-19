# MessageBird / Bird + **SMS only** for LinkUp (via Supabase Auth)

**Scope:** this document is **only for phone-number SMS** (OTP / `signInWithOtp`). It is **not** for signup confirmation email, password reset email, or other **transactional email**. Those are handled by **Supabase Auth’s mail** (see `EMAIL_VERIFICATION_SETUP.md`) and optionally **custom SMTP** (any provider you choose: Resend, Bird Email, SendGrid, etc.).

The app **does not** call Bird/MessageBird from the mobile bundle. SMS is sent by **Supabase Auth** after you configure a phone/SMS provider in the Supabase project.

MessageBird credentials belong in the **Supabase Dashboard** (or in a private backend), **not** in `EXPO_PUBLIC_*` variables.

## 1. MessageBird account

1. Sign up at [MessageBird](https://www.messagebird.com/).
2. Create or use an **SMS-enabled** sender (number or approved sender, depending on your region and compliance).
3. In the MessageBird Dashboard, create an **API key** (live for production; test for development).
4. Note your **originating number** or **sender ID** allowed for outbound SMS.

## 2. Connect MessageBird to Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Providers**.
2. Open **Phone** (SMS) and enable it.
3. Choose **MessageBird** if your Supabase version lists it as a built-in provider.
4. Paste the fields Supabase asks for (typically **API key**, **sender / originator**, and any **space / workspace** identifiers MessageBird shows).

If your Supabase version only lists **Twilio / Vonage / Textlocal**, use one of those, or use Supabase **Auth Hooks** / a **custom SMS sender** (Edge Function) that calls MessageBird’s REST API — that is advanced and not required for the default app, which uses `signInWithOtp` / `verifyOtp`.

Official overview: [Phone Login](https://supabase.com/docs/guides/auth/phone-login).

## 3. Redirect URLs and app scheme

Same as email/OAuth: add your app callback to **Authentication → URL Configuration → Redirect URLs**, e.g.:

- `linkup://auth/callback`

Phone OTP does not need MessageBird keys in `.env` on the device — only:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 4. Optional: mirror credentials in `.env` (team reference only)

You can store **non-client** names in `.env` for documentation or CI (never `EXPO_PUBLIC_` for secrets):

```env
# Copy into Supabase Dashboard → Auth → Phone (do not ship in the app)
MESSAGEBIRD_API_KEY=
MESSAGEBIRD_ORIGINATOR=
```

## 5. Verify

From the signup screen, use **Sign up with phone** → you should receive an SMS from your MessageBird sender (subject to trial/regional limits).
