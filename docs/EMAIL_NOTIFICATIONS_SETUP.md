# Email notifications — setup and verify (LinkUp)

This guide covers **transactional email for in-app notification events** (messages, offers, escrow, KYC, Premium, etc.). It is separate from **Supabase Auth email** (signup confirm, password reset).

---

## 1. What the app toggle does (and does not)

**Settings → Notifications & visibility → Email** saves:

```json
"preferences": {
  "notifications": {
    "email": true,
    "push": true
  }
}
```

| Toggle ON means | Toggle ON does **not** mean |
|-----------------|-----------------------------|
| User opted in; server **may** send email when a notification row is created | Emails send automatically with no backend setup |
| `notification-email` skips users with `email: false` | Auth emails (confirm signup, reset password) are included |

**In-app inbox** works without this guide (SQL triggers + Realtime). **Email** needs Resend + Edge Function + Database Webhook below.

---

## 2. What emails are sent (and what is excluded)

When `public.notifications` gets a new row, `notification-email` sends **generic** copy based only on `notification.type` — never amounts, KYC outcomes, or full in-app body text.

| `notification.type` (examples) | Email subject (generic) |
|-------------------------------|-------------------------|
| `message` | LinkUp — new message |
| `offer_*`, `mutual_agreement` | LinkUp — plan activity |
| `escrow_*`, `completion_release`, `cancel_chargeback` | LinkUp — escrow update |
| `dispute_opened` | LinkUp — dispute update |
| `kyc_*`, `account_restriction` | LinkUp — account or verification update |
| `premium_activated` | LinkUp — Premium |
| `plan_reminder` | LinkUp — reminder |
| `report_submitted` | LinkUp — report received |
| Other types | LinkUp — notification |

**Not covered by this toggle**

- Sign-up / email confirmation → [EMAIL_VERIFICATION_SETUP.md](./EMAIL_VERIFICATION_SETUP.md) (Supabase Auth SMTP)
- Password reset → [PASSWORD_RESET_EMAIL_SETUP.md](./PASSWORD_RESET_EMAIL_SETUP.md)
- Marketing / newsletters (not implemented)

Recipient address: `public.users.email` for the notified `user_id`.

---

## 3. Architecture

```text
App event (message, offer, …)
  → SQL trigger or Edge Function calls create_notification
  → Row inserted into public.notifications
  → Database Webhook (INSERT)
  → Edge Function notification-email
  → Resend API → user inbox
```

Paystack webhooks create notification rows too; the same webhook can send email for those types if configured.

You can run **two** webhooks on `notifications` INSERT (one for push, one for email) with **different** secrets and function URLs. See [PUSH_VERIFY_AND_SETUP.md](./PUSH_VERIFY_AND_SETUP.md) for push.

---

## 4. Resend (sending provider)

1. Create an account at [Resend](https://resend.com).
2. Create an **API key** (`re_...`) in the dashboard.

### No domain yet?

You can still finish the deploy script and test the **pipeline**, with limits:

| Mode | `RESEND_FROM` | Who receives mail |
|------|----------------|-------------------|
| **Dev (no domain)** | `LinkUp <onboarding@resend.dev>` (press Enter at the script prompt) | **Only** the email address you used to sign up for Resend — not arbitrary users |
| **Production** | `LinkUp <notify@yourdomain.com>` after domain verify | Any user with a row in `users.email` |

So for LinkUp:

- **Testing without a domain:** sign into the app with the **same email as your Resend account**, trigger a notification, and check that inbox. Confirms webhook + function + Resend work.
- **Real users (beta/production):** buy or use a domain you control (e.g. `linkup.app`, `getlinkup.com`), add it in [Resend → Domains](https://resend.com/domains), add DNS records, wait for **Verified**, then set `RESEND_FROM` to e.g. `LinkUp <notify@yourdomain.com>`.

Cheap options: any registrar (Namecheap, Cloudflare, Google Domains, etc.) — often ~$10–15/year. You do **not** need a full website; DNS records only.

### With a domain (recommended for launch)

1. Add and **verify** the domain in Resend (SPF + DKIM DNS records).
2. Set `RESEND_FROM` to an address on that domain, e.g. `LinkUp <notify@yourdomain.com>`.

Resend’s free tier is fine for development; production should use a verified domain to avoid spam folders.

---

## 5. Deploy `notification-email`

### Windows (PowerShell) — common fixes

| Problem | Fix |
|---------|-----|
| `'supabase' is not recognized` | Use **`npx supabase`** |
| `The '<' operator is reserved` | Do not use `<random>` — use real secret strings in quotes |
| `Unauthorized` on webhook | Header `x-linkup-webhook-secret` must **exactly** match `NOTIFICATION_EMAIL_WEBHOOK_SECRET` |
| `Server misconfigured` | Missing `RESEND_API_KEY`, `RESEND_FROM`, or Supabase keys on the function |

**Easiest:** from repo root:

```powershell
.\scripts\deploy-email-notification.ps1
```

**Manual** (replace values — no angle brackets):

```powershell
cd C:\Users\HP\Documents\ai-maker-projects\linkup

npx supabase login
npx supabase link --project-ref othikifibhjpfgyxpzcu

npx supabase secrets set RESEND_API_KEY=re_your_resend_api_key_here
npx supabase secrets set "RESEND_FROM=LinkUp <notify@yourdomain.com>"
npx supabase secrets set NOTIFICATION_EMAIL_WEBHOOK_SECRET=paste_a_long_random_string_here

npx supabase functions deploy notification-email --no-verify-jwt
```

**Secrets without CLI:** Supabase Dashboard → **Project Settings → Edge Functions → Secrets** → add the names above, then deploy **notification-email** from the Edge Functions UI.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are usually injected automatically for hosted projects; if deploy logs mention missing env, set them in the same Secrets screen.

---

## 6. Database Webhook (required)

Do this **after** §5 (function deployed + secrets set). The webhook only forwards the row; it does not send email by itself.

### Professional order of operations

```text
1. Generate NOTIFICATION_EMAIL_WEBHOOK_SECRET → store in password manager
2. supabase secrets set … + deploy notification-email
3. Create Database Webhook (this section)
4. Verify: Edge Function logs + Resend dashboard + inbox
```

### Prerequisites (do not skip)

| Check | Where |
|-------|--------|
| `notification-email` deployed | **Edge Functions** → status **Active** |
| `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFICATION_EMAIL_WEBHOOK_SECRET` set | **Project Settings → Edge Functions → Secrets** |
| Secret **not** in git, `.env`, or webhook name | Password manager / team vault only |
| User opted in | `profiles.preferences.notifications.email === true` |

Generate the webhook secret once (PowerShell example):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Use that value for **both** `NOTIFICATION_EMAIL_WEBHOOK_SECRET` (Edge secret) and the dashboard header below. **Never** reuse `PUSH_NOTIFICATION_WEBHOOK_SECRET`.

### Create the hook (Dashboard)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project **othikifibhjpfgyxpzcu**.
2. **Database → Webhooks** → **Create a new hook** (or **Enable Webhooks** if this is the first one).
3. Fill the form:

| Field | Value |
|-------|--------|
| **Name** | `notifications-insert-email` (stable; do not rename casually — ops runbooks reference it) |
| **Schema** | `public` |
| **Table** | `notifications` |
| **Events** | **Insert** only (not Update/Delete) |
| **Method** | `POST` |
| **Type** | Prefer **Supabase Edge Function** → `notification-email` if the UI offers it; otherwise **HTTP Request** (below) |

4. **HTTP headers** (required — function returns `401` if missing or wrong):

| Header | Value |
|--------|--------|
| `Content-Type` | `application/json` |
| `x-linkup-webhook-secret` | Exact copy of `NOTIFICATION_EMAIL_WEBHOOK_SECRET` (no `Bearer`, no quotes in the value field) |

5. If you chose **HTTP Request**, set **URL** to:

`https://othikifibhjpfgyxpzcu.supabase.co/functions/v1/notification-email`

6. **Save / Enable** the hook.

Supabase sends the [standard webhook payload](https://supabase.com/docs/guides/database/webhooks) (`type`, `table`, `schema`, `record`, `old_record`). `notification-email` reads `record.user_id` and `record.type`; you do not configure a custom body.

### Two hooks on the same table (normal)

| Hook name | Function | Secret env var |
|-----------|----------|----------------|
| `notifications-insert-push` | `push-on-notification` | `PUSH_NOTIFICATION_WEBHOOK_SECRET` |
| `notifications-insert-email` | `notification-email` | `NOTIFICATION_EMAIL_WEBHOOK_SECRET` |

Same table (`notifications`), same event (**Insert**), **different** functions and **different** secrets. One hook must not call both functions.

Do **not** put the service role key in the webhook URL or headers for these functions — auth is `x-linkup-webhook-secret` only (`--no-verify-jwt` on deploy is intentional).

### Security and ops practices

- **Least privilege:** Webhook fires on every insert; the Edge Function still checks `preferences.notifications.email` and loads the user email via service role internally.
- **Rotate secret:** Set a new `NOTIFICATION_EMAIL_WEBHOOK_SECRET`, update the dashboard header, redeploy is not required if only the secret value changed.
- **Monitoring:** **Edge Functions → notification-email → Logs** for `401` / `500` / Resend errors; **Database → Webhooks** for delivery history; Resend → **Emails** for sends.
- **Local Supabase:** Webhook URL must use `host.docker.internal`, not `localhost` — see [Supabase webhooks docs](https://supabase.com/docs/guides/database/webhooks#local-development). Production uses the `https://<ref>.supabase.co/functions/v1/...` URL above.

### Quick sanity check before a real notification

1. **Logs:** Trigger any insert into `notifications` (e.g. test message). Within seconds, **notification-email** should log a request (not only `401`).
2. **Wrong secret:** Temporarily break the header → expect `401` in logs → fix header → retry.
3. **Resend dev domain:** Without a verified domain, Resend only delivers to the email on your Resend account — sign into the app with that address for the first E2E test (§7).

---

## 7. Verify end-to-end

### A. User preferences

1. Sign in on the app.
2. **Settings → Notifications & visibility** → **Email** = ON.
3. Supabase → `profiles` → your row → `preferences` → confirm `"email": true` under `notifications`.
4. `users` table → your row has a valid **`email`**.

### B. Trigger a notification

Examples:

- Another test account sends you a **chat message**
- Someone submits an **offer** on your plan
- Complete a **Paystack** flow that creates a notification (if Paystack functions are deployed)

Confirm a new row in **`notifications`** for your `user_id`.

### C. Check delivery

1. **Resend Dashboard → Emails** — look for a sent message to your address.
2. Inbox / spam — subject should match the generic template for that `type`.
3. **Edge Functions → notification-email → Logs** — errors show as `Resend failed`, `No recipient`, or `User opted out of email`.

### D. Test opt-out

Turn **Email** OFF in app settings, trigger another notification → Resend should show **no** new send (`User opted out of email` in function logs).

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Toggle ON, no email | Webhook not created, function not deployed, or Resend secrets missing |
| `Unauthorized` in webhook logs | Wrong `x-linkup-webhook-secret` |
| `Server misconfigured` | Set `RESEND_API_KEY` and `RESEND_FROM` |
| `Resend failed` / 502 | Invalid API key, unverified domain, or `RESEND_FROM` not on verified domain |
| Email in spam | Verify domain DNS; warm up sending; avoid spammy subjects (generic copy helps) |
| In-app row but no email | Webhook only on push function, not `notification-email` |
| Auth signup email missing | Not this system — see [EMAIL_VERIFICATION_SETUP.md](./EMAIL_VERIFICATION_SETUP.md) |

---

## 9. Security and copy policy

- Never put escrow amounts, card data, or KYC pass/fail text in email bodies — the function uses type-based templates only.
- Do not commit `RESEND_API_KEY` to git; keep it in Supabase Edge Function secrets.
- `users.email` is read server-side with the service role inside the Edge Function.

---

## 10. Reference files

| File | Role |
|------|------|
| `supabase/functions/notification-email/index.ts` | Webhook handler + Resend send |
| `supabase/functions/notification-email/README.md` | Short deploy notes |
| `app/settings/notifications.tsx` | Email toggle + `preferences.notifications.email` |
| `docs/NOTIFICATIONS-AND-WEBHOOKS.md` | Push + email + Paystack overview |
| `docs/PUSH_VERIFY_AND_SETUP.md` | Companion guide for device push |

---

## 11. Production checklist

- [ ] Resend domain verified (SPF/DKIM)
- [ ] `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFICATION_EMAIL_WEBHOOK_SECRET` set
- [ ] `notification-email` deployed
- [ ] Database Webhook on `notifications` INSERT → `notification-email`
- [ ] Test message/offer creates row + email
- [ ] Opt-out (`email: false`) stops sends
- [ ] Push webhook configured separately if you want both channels
