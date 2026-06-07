# Paystack integration — Escrow & Premium (step-by-step)

LinkUp uses **Paystack** for:

| Flow | App screen | Server settlement |
|------|------------|-------------------|
| **Escrow** | `/escrow/[id]` → Fund escrow | `paystack-webhook-escrow` |
| **Premium** | `/premium/checkout` | `paystack-webhook-premium` |

Checkout is started via **`paystack-initialize`** (Paystack Initialize Transaction API).  
**Never** put `PAYSTACK_SECRET_KEY` in the mobile app — only in Supabase Edge secrets.

**Project ref (this repo):** `othikifibhjpfgyxpzcu`

---

## Architecture

```text
App (public key optional fallback)
  → paystack-initialize (user JWT)
  → Paystack hosted checkout (authorization_url)
  → User pays
  → Paystack POST charge.success
  → paystack-webhook-escrow OR paystack-webhook-premium
  → DB: escrow funded / premium activated + notifications (+ push/email via notifications webhooks)
```

---

## Part 1 — Paystack Dashboard

### 1.1 Create / open Paystack account

1. [https://dashboard.paystack.com](https://dashboard.paystack.com)
2. Complete business profile (live keys need activation).
3. Start with **Test Mode** (toggle top bar).

### 1.2 API keys

**Settings → API Keys & Webhooks**

| Key | Where it goes |
|-----|----------------|
| **Public Key** `pk_test_...` / `pk_live_...` | `.env` → `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` (fallback checkout only) |
| **Secret Key** `sk_test_...` / `sk_live_...` | Supabase secret `PAYSTACK_SECRET_KEY` only |

### 1.3 Webhook URL (one field per mode — not “Add webhook”)

Paystack does **not** have a separate “Webhooks → Add webhook” page. You get **one URL box** for Test and **one** for Live.

**How to find it**

1. Log in at [https://dashboard.paystack.com](https://dashboard.paystack.com)
2. Open **Settings** (left sidebar, or gear icon — on small screens: profile menu → Settings)
3. Open **API Keys & Webhooks** (tab at the top of Settings, not a submenu called “Webhooks”)
4. Scroll to **API Configuration – Test Mode** (or **Live Mode** when you go live)
5. Find the text field **Test Webhook URL** / **Live Webhook URL**
6. Paste the URL below → click **Save**

**URL to paste (handles both escrow and premium):**

```text
https://othikifibhjpfgyxpzcu.supabase.co/functions/v1/paystack-webhook
```

While testing, use **Test Mode** (toggle at top of dashboard) and fill **Test Webhook URL** only.  
When live, fill **Live Webhook URL** with the same path (live keys + live deploy).

Paystack sends all events to that one URL; LinkUp routes `charge.success` to escrow or premium using payment metadata.

- Paystack signs requests with your **secret key** (`x-paystack-signature`) — no extra header to configure.
- Events you care about: **`charge.success`** (other events are ignored).

**If you still don’t see “API Keys & Webhooks”**

- Complete merchant onboarding (some accounts hide Live until approved).
- Try direct link: [https://dashboard.paystack.com/#/settings/developer](https://dashboard.paystack.com/#/settings/developer) (path may vary slightly by account).
- Use **Test mode** — Test keys and Test Webhook URL are available earlier than Live.

**Advanced (optional):** You may still deploy `paystack-webhook-escrow` and `paystack-webhook-premium` separately; only the **router** URL above is needed in the Paystack dashboard.

---

## Part 2 — Supabase (server)

### 2.1 Link project & apply migrations

```powershell
cd C:\Users\HP\Documents\ai-maker-projects\linkup
npx supabase login
npx supabase link --project-ref othikifibhjpfgyxpzcu
npx supabase db push
```

Ensures `paystack_charge_processed`, escrow/plan tables, etc.

### 2.2 Deploy Paystack functions

```powershell
.\scripts\deploy-paystack.ps1
```

This sets `PAYSTACK_SECRET_KEY` and deploys:

| Function | JWT | Called by |
|----------|-----|-----------|
| `paystack-initialize` | **Yes** (user session) | Mobile app |
| `paystack-webhook-escrow` | **No** | Paystack |
| `paystack-webhook-premium` | **No** | Paystack |

Manual equivalent:

```powershell
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_secret_here
npx supabase functions deploy paystack-initialize
npx supabase functions deploy paystack-webhook-escrow --no-verify-jwt
npx supabase functions deploy paystack-webhook-premium --no-verify-jwt
```

### 2.3 Optional: push + email on payment events

Paystack webhooks already send **Expo push** from the Edge Functions.

For **email** too, configure Database Webhooks on `notifications` INSERT (see [EMAIL_NOTIFICATIONS_SETUP.md](./EMAIL_NOTIFICATIONS_SETUP.md)).

`push-on-notification` skips `escrow_funded` / `premium_activated` to avoid duplicate push if both paths run.

---

## Part 3 — Mobile app (`.env`)

Copy `.env.example` → `.env` and set:

```env
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxx

# Required on device builds — must be linkup:// (NOT exp:// from Expo dev)
EXPO_PUBLIC_PAYSTACK_PREMIUM_CALLBACK_URL=linkup://premium/success
# EXPO_PUBLIC_PAYSTACK_ESCROW_CALLBACK_URL=linkup://escrow/[id]
```

Restart Expo after changing `.env`:

```powershell
npx expo start -c
```

**Rules**

- `PAYSTACK_SECRET_KEY` → **never** in `.env` with `EXPO_PUBLIC_` prefix.
- User must have an **email** on their account for checkout.
- User must be **KYC verified** to fund escrow (app gate).

---

## Part 4 — Test escrow (end-to-end)

### 4.1 Test card (Paystack test mode)

Use Paystack [test cards](https://paystack.com/docs/payments/test-payments) (e.g. success card `4084084084084081`, CVV `408`, expiry any future date, PIN `0000`).

### 4.2 Flow

1. Two verified test users; create a **paid** plan and accept an offer.
2. Agreement → **Proceed to secure payment** → escrow screen.
3. Tap **Fund escrow** → browser opens Paystack.
4. Pay with test card.
5. Return to app (callback opens `/escrow/[id]`); pull to refresh if needed.

### 4.3 Verify server

| Check | Expected |
|-------|----------|
| `escrow_transactions.status` | `funded` |
| `plans.status` | `active` |
| `paystack_charge_processed` | row with `kind = escrow` |
| Paystack → Webhooks → event log | `200` on escrow URL |
| Edge Function logs | `paystack-webhook-escrow` success |

### 4.4 Split escrow (pattern B)

Each leg pays separately; webhook runs per leg with `metadata.escrow_leg` = `host` or `guest`. Plan goes `active` only when **both** legs are funded.

---

## Part 5 — Test Premium (end-to-end)

1. Sign in with email.
2. **Profile → Premium** → pick tier → **Checkout**.
3. **Pay with Paystack** (not Demo unless local-only).
4. After payment, land on `/premium/success` (screen refreshes profile).

### Verify server

| Check | Expected |
|-------|----------|
| `users.premium_until` | future date |
| `users.subscription_status` | `active` |
| `users.boost_credits` | increased per tier |
| `paystack_charge_processed` | `kind = premium` |

Tier prices (NGN kobo) must match server (`paystack-initialize` + `premiumTiers.ts`):

| Tier | Kobo |
|------|------|
| weekly | 150,000 |
| monthly | 399,000 |
| quarterly | 999,000 |

---

## Part 6 — Go live

1. Paystack: complete go-live checklist → **live** keys.
2. Update `PAYSTACK_SECRET_KEY` and `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` to **live** `sk_live_` / `pk_live_`.
3. Update Paystack webhook URLs (same paths; live dashboard).
4. Redeploy functions: `.\scripts\deploy-paystack.ps1`
5. Smoke-test one small real escrow and one premium purchase.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **“Sorry, you have been blocked”** on paystack.com | Paystack’s WAF often blocks **legacy** checkout URLs with long `metadata=` query strings, or **`exp://`** callback URLs from Expo dev. Use **server initialize only** (deploy `paystack-initialize`), set `EXPO_PUBLIC_PAYSTACK_PREMIUM_CALLBACK_URL=linkup://premium/success`, rebuild the app, retry. Try another network (disable VPN). If it persists, email Paystack support with your IP and timestamp. |
| **“Edge Function returned a non-2xx”** | Usually `paystack-initialize` failed (missing `PAYSTACK_SECRET_KEY`, invalid `sk_test_` key, or session expired). Run `.\scripts\deploy-paystack.ps1`, then retry — the app now shows the real server message. Also deploy `paystack-checkout-return` (HTTPS bridge for `linkup://` callbacks). |
| “Paystack is not configured” | Set `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`; deploy `paystack-initialize` |
| Checkout opens but escrow stays `pending_funding` | Webhook URL wrong, secret mismatch, or metadata missing — check Paystack webhook logs |
| `Invalid signature` on webhook | Wrong `PAYSTACK_SECRET_KEY` (test vs live) |
| `401` on `paystack-initialize` | User not signed in; function deployed with JWT off by mistake |
| Premium not active after pay | Check `paystack-webhook-premium` logs; `tier_id` / `user_id` in metadata |
| Amount mismatch (escrow) | Client amount must match escrow row (split leg vs full) |
| Duplicate premium credits | `paystack_charge_processed` should dedupe — check for duplicate references |

---

## Reference files

| File | Role |
|------|------|
| `lib/escrow/openEscrowCheckout.ts` | Escrow checkout |
| `lib/premium/openPremiumCheckout.ts` | Premium checkout |
| `supabase/functions/paystack-initialize/` | Initialize transaction |
| `supabase/functions/paystack-webhook-escrow/` | Escrow `charge.success` |
| `supabase/functions/paystack-webhook-premium/` | Premium `charge.success` |
| `scripts/deploy-paystack.ps1` | One-shot deploy |
| [NOTIFICATIONS-AND-WEBHOOKS.md](./NOTIFICATIONS-AND-WEBHOOKS.md) | Push/email around notifications |

---

## Production checklist

- [ ] Paystack test escrow + premium succeeded
- [ ] `PAYSTACK_SECRET_KEY` set in Supabase only
- [ ] `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` in `.env` / EAS secrets
- [ ] Two webhook URLs in Paystack Dashboard
- [ ] `paystack-initialize`, `paystack-webhook-escrow`, `paystack-webhook-premium` deployed
- [ ] `notifications` INSERT webhooks for email (optional)
- [ ] Demo “mark funded” disabled in production builds (`__DEV__` only today)
