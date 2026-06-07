# payment-reminder-sweep

Calls `sweep_awaiting_payment_reminders()` to insert `payment_reminder` rows for plans stuck in `awaiting_payment` with `pending_funding` escrow.

Push and email are **not** sent from this function directly — they fire when rows land in `public.notifications` (Database Webhooks → `push-on-notification` + `notification-email`).

## Schedule (Supabase Dashboard)

**Edge Functions → payment-reminder-sweep → Schedules** (or Cron):

- Cron: `*/15 * * * *` (every 15 minutes)
- Method: `POST`
- Header: `x-cron-secret: <PAYMENT_REMINDER_CRON_SECRET>` (if secret is set)

## Deploy

```bash
npx supabase secrets set PAYMENT_REMINDER_CRON_SECRET=your_long_random_string
npx supabase functions deploy payment-reminder-sweep --no-verify-jwt
```

Apply migration `20260528120000_payment_reminder_automation.sql` first.

## Reminder phases (deduped per user)

| Phase | When |
|-------|------|
| `due` | Immediately on escrow insert (trigger) |
| `nudge` | 30+ minutes after escrow created |
| `deadline_12h` | Funding deadline within 12 hours |
| `deadline_2h` | Funding deadline within 2 hours |
| `meetup_48h` | Meetup start within 48 hours |
| `meetup_24h` | Meetup start within 24 hours |

Respects `profiles.preferences.notifications.push` / `.email` in Edge Functions.
