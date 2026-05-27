# Push notifications — verify and complete setup (LinkUp)

Use this guide after the client changes in `registerPushNotifications.ts` and `NotificationInboxContext.tsx`. It walks through **device token → Supabase → Expo Push API** for all notification types.

---

## 1. What works out of the box

| Piece | Status |
|--------|--------|
| App registers Expo token | Yes — on sign-in, when app returns to foreground, if push is enabled in settings |
| Token storage | `profiles.preferences.expo_push_token` |
| In-app inbox + Realtime | Yes — while signed in |
| Paystack events (escrow funded, premium) | Push **if** Edge Functions are deployed and token exists |
| Messages, offers, KYC, etc. | In-app row from SQL triggers; **device push** needs step 4 below |

---

## 2. Android (your `expo run:android` build)

1. **Firebase** — Create a Firebase project, add Android app `com.linkup.app`, download **`google-services.json`** into the project root (file is gitignored; required for FCM).
2. **EAS FCM** — Upload FCM credentials in [Expo dashboard](https://expo.dev) → Project → Credentials → Android, or `eas credentials`.
3. Rebuild after adding `google-services.json`: `npx expo run:android` (or EAS build).

Without `google-services.json`, `getExpoPushTokenAsync` often fails silently on Android.

---

## 3. iOS (when you ship iOS)

Follow [EXPO-PUSH-NOTIFICATIONS.md](./EXPO-PUSH-NOTIFICATIONS.md): Push capability, APNs key in EAS, new build. TestFlight/dev build — not Expo Go.

---

## 4. Enable push for **all** in-app notifications (required for messages/offers)

SQL triggers only insert into `public.notifications`. To also send Expo push:

### A. Deploy Edge Functions

#### Windows (PowerShell) — common fixes

| Problem | Fix |
|---------|-----|
| `'supabase' is not recognized` | Use **`npx supabase`** instead of `supabase` |
| `The '<' operator is reserved` | **Do not** paste `<random>` — PowerShell treats `<` as redirection. Use a real secret in quotes (see below). |
| `Not logged in` | Run `npx supabase login` then `npx supabase link --project-ref othikifibhjpfgyxpzcu` |
| `Docker is not running` | Warning only — deploy still works; ignore for these functions |

**Easiest (recommended):** from repo root:

```powershell
.\scripts\deploy-push-functions.ps1
```

That script generates secrets, sets them, and deploys both functions. Copy the printed `PUSH_NOTIFICATION_WEBHOOK_SECRET` for the Database Webhook header.

**Manual commands** (replace the secret values — no angle brackets):

```powershell
cd C:\Users\HP\Documents\ai-maker-projects\linkup

npx supabase login
npx supabase link --project-ref othikifibhjpfgyxpzcu

npx supabase secrets set PUSH_NOTIFICATION_WEBHOOK_SECRET=paste_a_long_random_string_here
npx supabase secrets set PUSH_TEST_SECRET=paste_another_random_string_here

npx supabase functions deploy push-on-notification --no-verify-jwt
npx supabase functions deploy test-expo-push --no-verify-jwt
```

**Secrets without CLI:** Supabase Dashboard → **Project Settings → Edge Functions → Secrets** → add `PUSH_NOTIFICATION_WEBHOOK_SECRET` and `PUSH_TEST_SECRET`, then deploy functions from **Edge Functions** UI or run only the `deploy` lines above.

Also deploy Paystack webhooks if you use payments:

```powershell
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_live_your_key_here
npx supabase functions deploy paystack-webhook-escrow --no-verify-jwt
npx supabase functions deploy paystack-webhook-premium --no-verify-jwt
```

### B. Database Webhook (Supabase Dashboard)

1. **Database → Webhooks → Create a new hook**
2. **Table:** `public.notifications`
3. **Events:** Insert
4. **Type:** Supabase Edge Function → `push-on-notification`
5. **HTTP header:** `x-linkup-webhook-secret` = same value as `PUSH_NOTIFICATION_WEBHOOK_SECRET`

Or **HTTP Request** URL:

`https://othikifibhjpfgyxpzcu.supabase.co/functions/v1/push-on-notification`

with header `x-linkup-webhook-secret`.

The function skips `escrow_funded` and `premium_activated` when Paystack functions already sent push (no duplicates).

---

## 5. Verify on a physical device

### Step A — Token in database

1. Install the app on a **real phone** (not emulator-only for first test).
2. Sign in, allow notifications when prompted.
3. Settings → **Push notifications** = ON (opening this screen also triggers a token sync).
4. In Supabase → **Table Editor** → `profiles` → your row:

| Where to look | What you should see |
|---------------|---------------------|
| Column **`expo_push_token`** | `ExponentPushToken[xxxxxxxx...]` (after migration `20260527120000_profiles_expo_push_token_columns`) |
| Column **`preferences`** (JSON) | Same token inside the JSON: `"expo_push_token": "ExponentPushToken[...]"` |

Apply the migration if the column is missing:

```powershell
npx supabase db push
```

Or run the SQL from `supabase/migrations/20260527120000_profiles_expo_push_token_columns.sql` in the SQL Editor.

If both are empty, check Metro logs for `[push]` (permission denied, FCM / `google-services.json`, or missing EAS `projectId`).

### Step B — Send test push

**`Unauthorized`?** The header must **exactly** match the secret in Supabase (not the literal text `YOUR_PUSH_TEST_SECRET`). Set or reset:

```powershell
npx supabase secrets set PUSH_TEST_SECRET=LinkUpPushTestSecret2026
```

Use the **same string** in the request header below. After changing secrets, wait ~30s before calling the function again.

Replace `YOUR_USER_UUID` with your auth user id from Supabase → `profiles.user_id`.

PowerShell:

```powershell
$userId = "YOUR_USER_UUID"
$secret = "LinkUpPushTestSecret2026"
$body = @{ userId = $userId } | ConvertTo-Json
Invoke-RestMethod -Method POST `
  -Uri "https://othikifibhjpfgyxpzcu.supabase.co/functions/v1/test-expo-push" `
  -Headers @{ "x-push-test-secret" = $secret; "Content-Type" = "application/json" } `
  -Body $body
```

Or curl (Git Bash):

```bash
curl -X POST "https://othikifibhjpfgyxpzcu.supabase.co/functions/v1/test-expo-push" \
  -H "Content-Type: application/json" \
  -H "x-push-test-secret: YOUR_PUSH_TEST_SECRET" \
  -d "{\"userId\":\"YOUR_USER_UUID\"}"
```

You should get a banner: **LinkUp test** / *Push notifications are working.*

### Step C — End-to-end event

With the Database Webhook enabled, trigger a real event (e.g. another account sends you a message or offer). You should get:

- A row in `notifications`
- A device push when the app is backgrounded

---

## 6. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| No token in `preferences` | Permission denied, missing `google-services.json` (Android), or invalid EAS `projectId` |
| Token present, no push | Webhook not created, `push-on-notification` not deployed, or push disabled in settings |
| Push only for payments | Webhook missing; only Paystack functions call Expo today |
| `[expo-push] ticket DeviceNotRegistered` | Stale token — reopen app (foreground sync refreshes token) |
| Duplicate pushes | Both Paystack dispatch and webhook for same type — webhook skips premium/escrow_funded |

---

## 7. Email notifications (separate)

Transactional email for the same `notifications` rows uses **Resend** and `notification-email` — not the push toggle. See **[EMAIL_NOTIFICATIONS_SETUP.md](./EMAIL_NOTIFICATIONS_SETUP.md)**.

## 8. Reference files

- Client: `lib/notifications/registerPushNotifications.ts`, `contexts/NotificationInboxContext.tsx`
- Server: `supabase/functions/_shared/expoPush.ts`, `push-on-notification`, `test-expo-push`
- Config: `app.json` (`expo-notifications`, `extra.eas.projectId`)
