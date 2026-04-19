# Twilio + phone signup (Supabase Auth)

The LinkUp app **does not call Twilio from the mobile bundle**. It uses **Supabase Auth** (`signInWithOtp` / `verifyOtp`). Supabase sends SMS using whatever SMS provider you configure — **Twilio** is the usual choice.

## Why Twilio secrets are not `EXPO_PUBLIC_*`

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and related secrets **must never** be prefixed with `EXPO_PUBLIC_` or they would ship inside the app binary.
- Keep them in **Supabase** (dashboard or Edge Function secrets), or in a **private** backend.

## Configure Twilio in Supabase (recommended)

1. In [Twilio Console](https://console.twilio.com/): copy **Account SID** and **Auth Token**. Create a **Messaging Service** (or use an existing one) for SMS-capable senders.
2. In Supabase: **Authentication → Providers → Phone** — enable Phone provider.
3. Paste **Twilio Account SID**, **Auth Token**, and **Message Service SID** (or the fields your Supabase version shows for Twilio).
4. Under **Authentication → Providers → Phone**, ensure SMS is enabled for your project; set rate limits as needed.
5. Add test phone numbers in Twilio while in trial, or upgrade the account for production SMS.

Official guide: [Phone Login](https://supabase.com/docs/guides/auth/phone-login) (configure your SMS provider in the dashboard).

## `.env` in this repo

The root `.env` / `.env.example` lists `TWILIO_*` variables as a **checklist** so your team can copy values from Twilio Console into **Supabase Dashboard** (not into the Expo client). The app only needs:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `EXPO_PUBLIC_PHONE_DEFAULT_DIAL_CODE` — when users omit `+`, the app prepends this (e.g. `+234`).
- `EXPO_PUBLIC_PHONE_FORMAT_HINT` — copy shown under the phone field.
- `EXPO_PUBLIC_PHONE_SMS_PROVIDER_LABEL` — e.g. `Twilio (via Supabase)` for UI copy.

## Verify the flow

1. Open the signup screen → **Sign up with phone** → enter E.164 number → **Send verification code**.
2. You should receive an SMS from your Twilio sender.
3. Enter the code → **Verify & create account** → session is created by Supabase.

If SMS never arrives, check Twilio logs, Supabase Auth logs, and that trial accounts can send to verified destination numbers.
