# Payment reminders — push & email automation (`awaiting_payment`)

Automated reminders when a paid plan is in **`awaiting_payment`** and escrow is **`pending_funding`**. Delivery uses the same pipeline as other notifications:

```text
SQL trigger / cron sweep
  → INSERT public.notifications (type: payment_reminder)
  → Database Webhooks (INSERT)
  → push-on-notification (Expo)
  → notification-email (Resend)
```

User toggles **`profiles.preferences.notifications.push`** and **`.email`** are respected in those Edge Functions.

---

## What fires automatically

### 1. Immediate (escrow created)

Trigger on `escrow_transactions` INSERT when status is `pending_funding`:

| Who | Notification |
|-----|----------------|
| Payer(s) | **Secure payment needed** — open `/escrow/[id]` |
| Payee / other leg | **Waiting for secure payment** (one-time) |

Split escrow (**pattern B**): each unfunded leg gets a **due** notice; when one leg pays, the other gets **Your turn — fund your share**.

### 2. Scheduled (cron every 15 minutes recommended)

Edge Function **`payment-reminder-sweep`** calls `sweep_awaiting_payment_reminders()`.

| Phase | Condition | Dedupe key suffix |
|-------|-----------|-------------------|
| `nudge` | Escrow created 30+ minutes ago, still unfunded | `:nudge` |
| `deadline_12h` | `funding_deadline` within 12 hours | `:deadline_12h` |
| `deadline_2h` | `funding_deadline` within 2 hours | `:deadline_2h` |
| `meetup_48h` | Meetup start within 48 hours | `:meetup_48h` |
| `meetup_24h` | Meetup start within 24 hours | `:meetup_24h` |

Each phase fires **once per user per escrow** (`dedupe_key` on `notifications`).

---

## Deploy checklist

### A. Migration

```powershell
cd C:\Users\HP\Documents\ai-maker-projects\linkup
npx supabase db push
```

Or apply `supabase/migrations/20260528120000_payment_reminder_automation.sql` in the SQL editor.

### B. Cron Edge Function

```powershell
npx supabase secrets set PAYMENT_REMINDER_CRON_SECRET=paste_a_long_random_string_here
npx supabase functions deploy payment-reminder-sweep --no-verify-jwt
```

Or run:

```powershell
.\scripts\deploy-payment-reminders.ps1
```

### C. Schedule the sweep

**Supabase Dashboard → Edge Functions → payment-reminder-sweep → Schedules**

| Field | Value |
|-------|--------|
| Cron | `*/15 * * * *` |
| Method | `POST` |
| Header | `x-cron-secret` = same as `PAYMENT_REMINDER_CRON_SECRET` |

### D. Push + email webhooks (required for delivery)

Must already be configured — see:

- [PUSH_VERIFY_AND_SETUP.md](./PUSH_VERIFY_AND_SETUP.md) — `notifications` INSERT → `push-on-notification`
- [EMAIL_NOTIFICATIONS_SETUP.md](./EMAIL_NOTIFICATIONS_SETUP.md) — `notifications` INSERT → `notification-email`

Without both webhooks, reminders only appear **in-app** (Realtime inbox).

---

## Manual test

1. Create a paid plan → agreement → **Proceed to secure payment** (escrow row + `awaiting_payment`).
2. Check **Table Editor → notifications** for `type = payment_reminder` and `data.href` like `/escrow/...`.
3. Invoke sweep:

```powershell
curl -X POST "https://othikifibhjpfgyxpzcu.supabase.co/functions/v1/payment-reminder-sweep" `
  -H "x-cron-secret: YOUR_PAYMENT_REMINDER_CRON_SECRET"
```

4. Confirm push (device) and email (Resend) if toggles are ON.

---

## Related files

| File | Role |
|------|------|
| `supabase/migrations/20260528120000_payment_reminder_automation.sql` | Triggers + sweep RPC |
| `supabase/functions/payment-reminder-sweep/` | Cron entrypoint |
| `supabase/functions/push-on-notification/` | Expo push |
| `supabase/functions/notification-email/` | Resend email (`payment_reminder` copy) |
