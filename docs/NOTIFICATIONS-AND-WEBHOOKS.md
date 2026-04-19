# Notifications, Paystack webhooks, and push (LinkUp)

Production setup for **in-app notifications**, **Expo push**, and **Paystack** settlement.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `paystack-webhook-escrow` | `charge.success` for escrow — verifies signature, marks escrow `funded`, plan `active`, notifies payer/payee, records idempotency. |
| `paystack-webhook-premium` | `charge.success` for Premium — verifies signature, claims charge (no double credits), updates `users`, notifies, stores prefs reference. |
| `push-on-notification` | Optional: Database Webhook on `notifications` INSERT → Expo push (for SQL triggers without duplicating paystack pushes). |
| `notification-email` | Optional: Database Webhook on `notifications` INSERT → Resend email (generic copy by type). |

Deploy:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
supabase functions deploy paystack-webhook-escrow --no-verify-jwt
supabase functions deploy paystack-webhook-premium --no-verify-jwt
```

Paystack Dashboard → **Developers → Webhooks** — add **two** URLs (same secret key verifies both):

- `https://<project-ref>.supabase.co/functions/v1/paystack-webhook-escrow`
- `https://<project-ref>.supabase.co/functions/v1/paystack-webhook-premium`

Use **charge.success** (or “All events” and let functions ignore non-matching metadata).

## Metadata (client → Paystack)

Already set by the app:

- **Escrow** (`lib/escrow/openEscrowCheckout.ts`): `linkup`, `transaction_type: escrow`, `escrow_id`, `plan_id`.
- **Premium** (`lib/premium/openPremiumCheckout.ts`): `linkup`, `transaction_type: premium`, `tier_id`, `user_id`.

## Idempotency

Table `paystack_charge_processed` stores each Paystack `reference` once (`premium` / `escrow`).

## SQL event → in-app row

Migration `20240426000000_notification_engine_triggers.sql` enqueues:

- Offer accepted → `mutual_agreement`
- New message → `message` (low priority)
- Escrow status (non–pending→funded) → `escrow_status`
- Dispute opened → `dispute_opened`
- KYC approved/rejected → `kyc_decision`

`offer_new` was already handled in `20240418000000_notifications.sql`.

## Push from triggers (optional)

Paystack functions call Expo push directly after `create_notification`.

For trigger-only rows, either:

1. Deploy `push-on-notification`, set secret `PUSH_NOTIFICATION_WEBHOOK_SECRET`, and add a **Database Webhook** on `public.notifications` INSERT → POST that function with header `x-linkup-webhook-secret`, **or**
2. Rely on realtime in the app (no background push for those events).

The push function skips `escrow_funded` and `premium_activated` if you use both paths (avoids duplicates).

## Client

- Tokens: `profiles.preferences.expo_push_token` (see `lib/notifications/registerPushNotifications.ts`).
- Realtime: `NotificationInboxContext` subscribes to `notifications` for the signed-in user.
- Notification UI: `app/notifications.tsx` (Today / Earlier, filters, swipe actions).

## Security

- Never expose `PAYSTACK_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the Expo app.
- RLS: users only read/update their own `notifications` rows; inserts are server-side only (`create_notification`).
