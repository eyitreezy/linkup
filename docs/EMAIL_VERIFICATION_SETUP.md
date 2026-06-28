# Email verification (signup) + deep link back to LinkUp

## Supabase settings

1. **Authentication → Providers → Email** — ensure Email auth is enabled.
2. **Authentication → Email** (or **Providers → Email** → advanced):
   - Turn **“Confirm email”** **on** for production (users must verify before a full session is issued).
   - For quick local testing only, you can turn it **off** (not recommended for production).
3. **Authentication → URL Configuration**
   - **Site URL**: your app’s web URL or a placeholder; mobile still uses custom scheme links.
   - **Redirect URLs** — add exactly what the app uses for deep links, e.g.:
     - `linkup://auth/callback`
     - `exp://127.0.0.1:8081/--/auth/callback` (Expo Go dev, if you use it)
   - The signup call passes **`emailRedirectTo`** = `getAuthRedirectUrl()` (same as OAuth), so the **verify** link in the email should send the user back into the app on that URL.

## App behavior

- **Email/password signup** with confirmation enabled: user sees “Check your email” and can **Resend**.
- After tapping the link, the OS opens **`linkup://auth/callback?...`** (or with tokens in the hash). `auth/callback` + `completeOAuthReturnUrl` complete the session (`token_hash` / PKCE / hash tokens).
- User is then sent to **`/`** → **onboarding** if `profiles.onboarding_status === 'pending'`.

## Google sign-in

- Google users are already verified by Google; **no email confirmation step** in the app.
- After OAuth completes, the app **waits for a Supabase session** (short poll) and only then navigates — so the user is registered in Supabase before routing.

## In-app notification emails (messages, offers, escrow, etc.)

Separate from Auth signup email. Requires Resend + `notification-email` Edge Function + Database Webhook. See **[EMAIL_NOTIFICATIONS_SETUP.md](./EMAIL_NOTIFICATIONS_SETUP.md)**.

## Password reset emails

Reset messages use the same redirect (`linkup://auth/callback`) and the same SMTP/template pitfalls as signup confirm. If links are not tappable or land in spam, follow **[PASSWORD_RESET_EMAIL_SETUP.md](./PASSWORD_RESET_EMAIL_SETUP.md)** and paste the HTML from `supabase/email-templates/recovery.html` into **Authentication → Email Templates → Reset password**.

## Custom SMTP (Bird vs Resend vs others)

**Signup authentication emails** (confirm address, magic links, password reset) are sent by **Supabase**, not by the Expo app. By default Supabase uses its own mail infrastructure. If you want a specific provider instead of Resend:

- In **Supabase Dashboard → Project Settings → Authentication** (or **Auth → SMTP** depending on UI), enable **custom SMTP** and enter the **SMTP host, port, username, password**, and sender identity your provider gives you.
- **Bird** can be a reasonable choice if you already use Bird and their **email / transactional mail** product exposes **SMTP** that Supabase accepts (or you use a supported integration path). You do **not** need to enable **Bird SMS** to send auth email — SMS and email are separate products.
- **Resend** is popular with developers for transactional email and has straightforward SMTP docs; choosing **Bird instead of Resend** is mostly a **vendor / pricing / consolidation** decision (e.g. one bill for SMS + email), not a requirement of this app.

If a doc in this repo is named `MESSAGEBIRD_PHONE_SETUP.md`, that file is **SMS-only** (phone OTP), not mail API setup.

## “Undelivered mail returned to sender” (bounce to admin@flowdecklabs.com)

Signup confirmation is sent by **Supabase Auth**, not the LinkUp app. A bounce to **admin@flowdecklabs.com** means that address is your configured **SMTP sender / return-path** and the message **never reached the user’s inbox** (or was rejected by their provider).

**This is not fixable in the mobile app** — fix it in Supabase + your mail provider.

### 1. Read the bounce email

Open the bounce in admin@flowdecklabs.com and note the SMTP status line, for example:

| Code / message | Usual cause |
|----------------|-------------|
| `553` / sender address rejected | **From** address not allowed on your SMTP account |
| `550` / relay access denied | Wrong SMTP host, port, username, or password |
| `550` / domain not verified | Sending domain missing SPF/DKIM in DNS |
| `550` / user unknown | Typo in the signup email (test with Gmail) |

### 2. Fix Supabase Auth SMTP (production)

1. [Supabase Dashboard](https://supabase.com/dashboard) → project **LinkUp** (`othikifibhjpfgyxpzcu`) → **Project Settings → Authentication → SMTP Settings**.
2. Enable **custom SMTP** (default Supabase mail is dev-only and often bounces or rate-limits).
3. Use a **transactional provider** (Resend is already used for in-app notification mail in this repo):

   | Field | Resend example |
   |-------|----------------|
   | Host | `smtp.resend.com` |
   | Port | `465` (SSL) or `587` (STARTTLS) |
   | Username | `resend` |
   | Password | Your Resend API key (`re_…`) |
   | Sender email | `LinkUp <auth@flowdecklabs.com>` or `noreply@flowdecklabs.com` |

4. **Do not use `admin@`** as the sender unless that mailbox is explicitly authorized on your SMTP provider. Prefer `auth@` or `noreply@` on a **verified domain**.

### 3. Verify the domain in Resend (or your provider)

1. [Resend → Domains](https://resend.com/domains) → add **flowdecklabs.com**.
2. Add the **SPF**, **DKIM**, and (recommended) **DMARC** DNS records Resend shows.
3. Wait until status is **Verified** before testing signup again.

`RESEND_FROM` on the `notification-email` Edge Function is **separate** from Auth SMTP — both need a verified domain, but you must configure **Auth SMTP in the Supabase Dashboard** for signup confirm emails.

### 4. Supabase Auth checklist

- **Authentication → Providers → Email** — Email enabled; **Confirm email** on for production.
- **Authentication → URL Configuration → Redirect URLs** — include `linkup://auth/callback`.
- **Authentication → Email Templates → Confirm signup** — paste HTML from [`supabase/email-templates/confirmation.html`](../supabase/email-templates/confirmation.html).
- **Authentication → Logs** — after a test signup, check for mail send errors.
- Turn **link tracking off** on your SMTP provider for auth mail (see [PASSWORD_RESET_EMAIL_SETUP.md](./PASSWORD_RESET_EMAIL_SETUP.md)).

### 5. Dev shortcut (while fixing SMTP)

**Authentication → Providers → Email** → turn **Confirm email** **off** temporarily so sign-up works without sending mail. Turn it back on before production.

### 6. Test

1. Sign up with a **real Gmail** address you control.
2. Confirm the user receives mail from your new sender (not `noreply@mail.app.supabase.io` unless you intentionally use default mail).
3. Tap the link on the **same device** with the dev/production build installed.

## “Email rate limit exceeded”

This comes from **Supabase Auth**, not the LinkUp app. The **default** mailer is meant for testing and enforces **very low** limits (on the order of a few auth emails per hour per project or address).

**What you can do:**

1. **Wait** — limits reset after a cooldown (often ~1 hour).
2. **Stop retrying** — each failed signup, resend, or password-reset attempt counts. The app now uses a **60s cooldown** on resend / reset to reduce accidental spam during dev.
3. **Development shortcut** — **Authentication → Providers → Email** → turn **Confirm email** **off** temporarily so sign-up does not send a message every attempt (turn back on for production).
4. **Production fix (recommended)** — **Project Settings → Authentication → SMTP**: enable **custom SMTP** (Resend, SendGrid, AWS SES, Postmark, etc.). Delivery is more reliable and you can raise caps.
5. **Raise Auth rate limits** — after custom SMTP, open **Authentication → Rate Limits** (or [Auth rate limits docs](https://supabase.com/docs/guides/auth/rate-limits)) and adjust email-related limits for your traffic.

The app cannot remove Supabase’s server-side cap; only your project configuration (or waiting) can.
