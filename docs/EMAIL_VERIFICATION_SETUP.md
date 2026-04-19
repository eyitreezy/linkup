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

## Custom SMTP (Bird vs Resend vs others)

**Signup authentication emails** (confirm address, magic links, password reset) are sent by **Supabase**, not by the Expo app. By default Supabase uses its own mail infrastructure. If you want a specific provider instead of Resend:

- In **Supabase Dashboard → Project Settings → Authentication** (or **Auth → SMTP** depending on UI), enable **custom SMTP** and enter the **SMTP host, port, username, password**, and sender identity your provider gives you.
- **Bird** can be a reasonable choice if you already use Bird and their **email / transactional mail** product exposes **SMTP** that Supabase accepts (or you use a supported integration path). You do **not** need to enable **Bird SMS** to send auth email — SMS and email are separate products.
- **Resend** is popular with developers for transactional email and has straightforward SMTP docs; choosing **Bird instead of Resend** is mostly a **vendor / pricing / consolidation** decision (e.g. one bill for SMS + email), not a requirement of this app.

If a doc in this repo is named `MESSAGEBIRD_PHONE_SETUP.md`, that file is **SMS-only** (phone OTP), not mail API setup.
