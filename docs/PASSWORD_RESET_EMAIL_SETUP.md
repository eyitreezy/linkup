# Password reset email — deliverability, clickable links, and LinkUp deep links

Password reset messages are sent by **Supabase Auth**, not the Expo app. The app calls `resetPasswordForEmail` with `redirectTo` = `linkup://auth/callback` (see `lib/auth/passwordReset.ts`).

## 1. Fix “nothing in the email is clickable”

This is almost always the **email template** or your **SMTP provider**, not the React Native app.

### A. Replace the Reset password template

1. Open **Supabase Dashboard → Authentication → Email Templates → Reset password**.
2. Set **Subject** to something clear, e.g. `Reset your LinkUp password`.
3. Paste the HTML from [`supabase/email-templates/recovery.html`](../supabase/email-templates/recovery.html).

That template uses a real `<a href="{{ .ConfirmationURL }}">` button plus a plain link fallback. The default Supabase sample sometimes shows **plain text** (“Reset Password”) with **no** `href`, which matches “I can’t tap anything.”

### B. Turn off link tracking on custom SMTP

If you use **SendGrid, Mailgun, Brevo, etc.** with **click/open tracking**, the provider **rewrites** `{{ .ConfirmationURL }}`. That often breaks:

- `linkup://` deep links
- One-time tokens (link “already used”)

**Disable link tracking** for auth/transactional mail. See [Supabase — Email tracking](https://supabase.com/docs/guides/auth/auth-email-templates#email-tracking).

### C. Corporate / Outlook “Safe Links”

Microsoft Defender **prefetches** links and can consume a one-time token before you tap it. If that happens:

- Mark the sender as **not junk**, or
- Use a personal mailbox for testing, or
- Consider OTP-style reset later (`{{ .Token }}` in template + in-app code entry).

## 2. Reduce spam folder placement

Default Supabase mail is fine for dev but often lands in **Spam** without proper DNS.

1. **Project Settings → Authentication → SMTP** — enable **custom SMTP** (Resend, Postmark, AWS SES, etc.).
2. Configure **SPF, DKIM, and DMARC** for your sending domain (your provider’s docs).
3. Use a **From** address on that domain (e.g. `noreply@yourdomain.com`), not a random Gmail.
4. Avoid spammy subject lines; use “Reset your LinkUp password”.
5. Ask users to check **Spam / Promotions** and mark as “Not spam” during beta.

See also [`EMAIL_VERIFICATION_SETUP.md`](./EMAIL_VERIFICATION_SETUP.md) (same redirect URL and SMTP notes).

## 3. Redirect URL (required for the link to open the app)

**Authentication → URL Configuration → Redirect URLs** must include:

- `linkup://auth/callback`

Optional for Expo Go dev:

- `exp://127.0.0.1:8081/--/auth/callback`

Do **not** use `localhost` as `redirectTo` on a physical phone. Leave `EXPO_PUBLIC_AUTH_REDIRECT_URL` empty in `.env` so the app uses `linkup://auth/callback` from `app.json` `scheme`.

After tapping the link, the OS should open LinkUp → `/auth/callback` → **Create a new password** screen.

## 4. App behavior (already implemented)

- `resetPasswordForEmail` → `getAuthRedirectUrl()`
- Deep link handled in `app/auth/callback.tsx` + `completePostAuthFromDeepLink`
- **`PASSWORD_RECOVERY`** auth event routes to `/(auth)/reset-password` even when the final URL no longer contains `type=recovery` (common with PKCE)

## 5. Quick test checklist

| Step | Expected |
|------|----------|
| Request reset from **Forgot password** on the device | “Check your email” |
| Email has a **purple button** + underlined URL | Both tappable |
| Tap link on **same device** with dev/production build | App opens, new password form |
| Supabase redirect allow list | Contains `linkup://auth/callback` |
| Custom SMTP | Link tracking **off** |

If the button works in a browser but not in Gmail’s in-app browser, use **Open in Chrome/Safari** or long-press → Open in app.
