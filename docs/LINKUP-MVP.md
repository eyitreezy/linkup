# LinkUp MVP — build & deploy notes

This document complements `LINKUP-USERFLOW.md` with **implementation mapping** for the shipped MVP.

## Stack

| Layer | Choice |
|--------|--------|
| App | React Native + TypeScript + Expo (expo-router) |
| Backend | Supabase (Postgres, Auth, Storage, Realtime) |
| Payments | Paystack (public key in app; **secret key only on server/Edge Function**) |
| AI | Client-side heuristics + hooks for Edge Functions (`lib/ai.ts`) |

## Environment

Copy `.env.example` to `.env` at the project root. Expo reads `EXPO_PUBLIC_*` at build time.

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — required for auth and data.
- `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` — browser checkout URLs from Profile / Escrow screens.
- `PAYSTACK_SECRET_KEY` — **do not** put in the mobile bundle; use Supabase Edge Functions or a backend for webhooks and protected charges.
- `AI_VERIFICATION_KEY` — use server-side; wire `lib/ai.ts` to your Edge Function URL when ready.

`app.config.js` passes env into `expo-constants` `extra` for runtime.

## Database

- **Migration:** `supabase/migrations/20240406120000_linkup_init.sql` — enums, tables, RLS, triggers, storage buckets.
- **Seed:** `supabase/seed.sql` — optional admin row (replace UUID).
- **Realtime:** In Supabase Dashboard → Database → Replication, add tables: `messages`, `plans`, `plan_offers`, `escrow_transactions`, `app_notifications` (see comments in migration).

## Security

- Passwords: only in Supabase Auth (`auth.users`), never duplicated in `public`.
- KYC files: private bucket `verification`; path prefix `userId/...`.
- Admin updates `users` / `profiles` for other users via RLS policies `users_update_admin`, `profiles_update_admin`.

## Paystack & escrow

1. User accepts offer → app inserts `escrow_transactions` (`pending_funding`).
2. Payer opens Paystack checkout (client-side URL with public key).
3. **Production:** webhook verifies payment and sets `funded` (see `supabase/functions/paystack-webhook/README.md`).
4. MVP includes **“Demo: mark as funded”** for local testing without a webhook.

## Screens (route map)

| Route | Purpose |
|--------|---------|
| `/` | Auth redirect |
| `/(auth)/login`, `/(auth)/signup` | Supabase email/password |
| `/(tabs)` | Plans list, Messages, Profile |
| `/plan/create` | Create negotiating plan |
| `/plan/[id]` | InDrive-style offers + accept → escrow |
| `/escrow/[id]` | Escrow status + Paystack + release / dispute |
| `/chat/[id]` | DM thread + realtime |
| `/verification` | KYC uploads |
| `/support`, `/disputes` | Tickets & disputes |
| `/admin` | Admin queue (requires `admins` row) |
| `/media/[id]` | Signed URL viewer |

## Run locally

```bash
npm install
npx expo start
```

Apply the SQL migration in the Supabase SQL editor (or `supabase db push` if CLI is linked).

## First admin

After your user exists in `auth.users` and `public.users`, insert:

```sql
insert into public.admins (user_id, role) values ('<your-user-uuid>', 'super_admin');
```

Then the **Admin** button appears on Profile.
