# notification-email

Sends **generic** transactional email when `public.notifications` gets a new row. Copy is **only** from `notification.type`, not from `title` / `body` / `data` (so amounts and KYC outcomes stay in-app).

**Full setup guide:** [docs/EMAIL_NOTIFICATIONS_SETUP.md](../../../docs/EMAIL_NOTIFICATIONS_SETUP.md)

## 1. Resend

1. Create [Resend](https://resend.com) API key and verify a sending domain.
2. Set Edge Function secrets: `RESEND_API_KEY`, `RESEND_FROM` (e.g. `LinkUp <notify@yourdomain.com>`).

## 2. Deploy function

```bash
supabase secrets set RESEND_API_KEY=re_... RESEND_FROM="LinkUp <notify@yourdomain.com>" NOTIFICATION_EMAIL_WEBHOOK_SECRET="$(openssl rand -hex 16)"
supabase functions deploy notification-email --no-verify-jwt
```

Also set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` if not already present for functions.

## 3. Database webhook

1. Supabase Dashboard → **Database** → **Webhooks** → **Create a new hook**.
2. **Table**: `notifications` · **Events**: Insert.
3. **HTTP Request**: POST to `https://<project-ref>.supabase.co/functions/v1/notification-email`
4. **HTTP Headers**: add `x-linkup-webhook-secret` = same value as `NOTIFICATION_EMAIL_WEBHOOK_SECRET`.

## 4. User opt-out

If `profiles.preferences.notifications.email === false`, the function skips sending (matches in-app settings).

## Alternatives

- Replace Resend with SendGrid/Postmark/SES inside this function (same idea: generic subject/body only).
- **Scheduled job**: poll `notifications` where `created_at > last_run` and `email_sent_at` is null — requires an extra column and batching; webhooks are simpler for “on insert”.
