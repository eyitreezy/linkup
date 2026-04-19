# LinkUp — prioritized backlog (unimplemented / partial)

Items below are ordered so you can **work top to bottom**: earlier rows unblock real money, reliability, and compliance; later rows are polish or spec depth.

Cross-reference: product intent in [LINKUP-USERFLOW.md](./LINKUP-USERFLOW.md); push setup in [EXPO-PUSH-NOTIFICATIONS.md](./EXPO-PUSH-NOTIFICATIONS.md).

---

## P0 — Ship real commerce (do these first)

| # | Item | Why first | Notes |
|---|------|-----------|--------|
| 1 | **Paystack webhook — escrow** | Without server-verified `charge.success`, escrow can stay wrong if users pay outside the demo path. | Implement Edge Function per `supabase/functions/paystack-webhook/README.md`: verify signature, set `escrow_transactions` funded, advance plan status. |
| 2 | **Paystack webhook — premium** | Client-side / demo `applyPremiumPurchase` must not be the only path in production. | On success, set `users.premium_until`, `subscription_status`, `boost_credits` from trusted metadata (never trust the app alone). |
| 3 | **Expo Push — server sender** | In-app rows exist (e.g. offers); devices won’t get pushes until something calls the Expo Push API with stored tokens. | After `create_notification` (or in same Edge path), read `profiles.preferences.expo_push_token` and POST to Expo; keep copy non-sensitive. |

---

## P1 — Trust, safety, and verification

| # | Item | Why | Notes |
|---|------|-----|--------|
| 4 | **KYC vendor / real pipeline** | Placeholder AI does not replace identity checks for production. | Replace `runKycAiPlaceholder` with vendor webhooks or Edge Functions; align `verification_requests` outcomes. |
| 5 | **Moderation persistence** | Audit and escalation need a real trail. | Replace `lib/messaging/moderationLog.ts` placeholder with Supabase inserts and/or Edge moderation. |
| 6 | **Report user / content (in-app)** | Spec and notification types reference reports; flow is thin today. | Add report action from chat/plan; create ticket or `report_submitted` notification; avoid sensitive copy in push. |
| 7 | **Admin KYC case detail** | Approve/reject without seeing ID/video is risky. | Extend `app/admin` with secure review UI (storage URLs, audit log). |

---

## P2 — Auth and account completeness

| # | Item | Why | Notes |
|---|------|-----|--------|
| 8 | **Forgot password / reset** | Expected for any email/password app. | Supabase Auth reset flow + screens in `(auth)`. |
| 9 | **Welcome / entry UX (optional)** | Spec backlog lists welcome; current `app/index.tsx` jumps to login. | Only if you want marketing or OTP-first entry. |
| 10 | **Delete account — full DSR** | Current flow suspends + hides profile; policy may require purge workflow. | Define retention; optional support ticket + automated purge job. |

---

## P3 — Notifications and engagement depth

| # | Item | Why | Notes |
|---|------|-----|--------|
| 11 | **Email notifications breadth** | §7 lists many events; DB trigger today is a template (e.g. new offer → in-app). | Wire `notification-email` (or similar) to priority events; batch low-priority digests if needed. |
| 12 | **Messaging caps for unverified** | §6.1 calls out limits for trust. | Define caps in DB/RLS or Edge; reflect in UI. |

---

## P4 — Premium and discovery polish

| # | Item | Why | Notes |
|---|------|-----|--------|
| 13 | **Map view on Plans (optional)** | Spec optional map on homepage. | Requires maps config + UI; not blocking core loop. |
| 14 | **Boost-only / IAP pack SKUs** | Spec separates consumable boost packs from subscription. | Paystack one-off products or store IAP per platform policy. |
| 15 | **Incognito / reduced visibility** | Listed under premium themes in spec. | Extend privacy settings + feed queries. |
| 16 | **Negotiation “rewind”** | Spec: undo last counter (abuse-safe). | Separate from feed “undo hide”; needs negotiation history + rules. |

---

## P5 — UX consistency and smaller gaps

| # | Item | Why | Notes |
|---|------|-----|--------|
| 17 | **Post-onboarding `SoftKycPrompt`** | Onboarding sets `markSoftKycPromptPending` but nothing consumes it; `PlansKycBanner` covers similar intent. | Either wire `SoftKycPrompt` on first tabs session or remove dead storage to avoid confusion. |
| 18 | **Disputes detail screen** | List exists; full Phase-11 depth does not. | Timeline, status, evidence uploads if product requires. |
| 19 | **Admin support tickets** | Admin sees subjects; thin resolution UX. | Thread view, status changes, internal notes. |
| 20 | **Restricted / suspended account UX** | Spec states; limited dedicated “locked” experience. | Read-only screens, appeals copy, aligned with `account_status`. |
| 21 | **AI trust / moderation Edge** | `lib/ai.ts` is heuristic + optional URL. | Production: secure keys on server, real models or policies. |
| 22 | **App Store subscriptions** | Spec: use store subs where policy requires. | Parallel or replace Paystack for iOS premium if needed. |

---

## How to use this doc

1. Finish **P0** before calling payments or push “done” in production.  
2. Tackle **P1** before scaling users or marketing trust heavily.  
3. **P2–P4** can overlap with P1 depending on team size.  
4. **P5** is cleanup and depth — schedule when core revenue and safety paths are stable.

When you complete an item, delete or strike its row here (or move to a “Done” section) so the file stays your single queue.
