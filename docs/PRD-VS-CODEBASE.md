# LinkUp PRD v2.0 (MVP) vs Current Codebase

**Source:** LinkUp Product Requirements Document — Version 2.0, MVP Edition — Nigeria (2026), as provided.  
**Codebase snapshot:** `linkup` repo (Expo / React Native + Supabase).

This document maps PRD requirements to **what is already shipped in code** versus **what still needs product/engineering work**. It is for internal planning only.

---

## 1. Strong alignment (core MVP themes)

The repo already reflects the PRD’s core bet: **plans on a discover surface**, **offer negotiation**, **in-app agreements**, **Paystack-backed escrow**, **KYC gating for paid actions**, **1:1 chat**, **disputes/support entry points**, **notifications**, and **premium upsells** (boost, saved plans, filters, travel browse).

---

## 2. Features the app already has (PRD-relevant)

| PRD area | Implemented today (evidence in repo) | Notes vs PRD |
|----------|--------------------------------------|----------------|
| **Auth & session** | Email/password + Google OAuth patterns; phone auth UI (`PhoneAuthSection`); `AuthContext`, `app/(auth)/`, `app/auth/callback.tsx` | PRD: SMS OTP — confirm provider wiring end-to-end per environment. |
| **Onboarding / profile wizard** | Multi-step onboarding (`app/onboarding/`), photos, prompts, interests, intent, discovery prefs; edit profile (`app/settings/edit-profile.tsx`) | PRD “budget comfort range” / city list may differ from current fields — compare onboarding steps to Section 7.1. |
| **Discover feed** | Tab discover (`app/(tabs)/index.tsx`), swipe deck (`components/discovery/`), plan feed merge (`lib/plans/planFeedMerge.ts`) | PRD: optional **list view**, **meet-type tags**, **budget tier**, **escrow pattern** on cards — not fully modeled in `PlanDraft` (title/description/location/time/price/visibility only). |
| **Plan creation** | Create flow (`app/plan/create/`), visibility public / radius / friends (`PlanDraftContext` maps to PRD public / radius / connections-style) | No **Mood Plan** mode, no **meet type taxonomy** enums, no **Pattern B/C** selection in draft. |
| **Plan detail & engagement** | Plan overview, interest, calendar hooks, premium gates (`app/plan/[id]/`) | PRD: **exact address** gated until post-agreement — confirm behavior vs `location_label` usage. |
| **Offers & negotiation** | Offers tab, negotiate screen, counters/rounds (`app/(tabs)/offers.tsx`, `app/plan/[id]/negotiate.tsx`, `lib/plans/*`) | PRD: up to **3 rounds** — verify `offerRules` / DB constraints match. |
| **Agreement** | Agreement route in plan stack (`app/plan/[id]/agreement.tsx`), agreement fields on plans/offers in migrations | PRD **pre-agreement mandatory pop-up** (cancellation matrix, both parties) — treat as **partial until UX audited** against Section 9. |
| **Escrow (single checkout)** | One `escrow_transactions` row per plan: `payer_id` / `payee_id`, `amount_cents`, statuses `pending_funding` → `funded` → `released` / `disputed`; Paystack metadata + webhook (`lib/plans/planAgreementActions.ts`, `lib/escrow/*`, `supabase/functions/paystack-webhook-escrow/`) | **Differs from PRD Pattern A:** see **§3.2**. No Pattern B/C, no platform fee line items, no min/max caps in schema. |
| **Completion / release** | Timeline steps for funded → released; dispute/refund states in schema | PRD **24h auto-release**, **dual mutual completion**, **pre-meetup “confirm attendance” 1–2h** — confirm server rules vs UI (`escrow` + `plans` statuses). |
| **Disputes** | Disputes screen (`app/disputes.tsx`), `escrow_disputes`, admin can resolve from app (`app/admin/index.tsx`) | PRD: **in-app timestamped video** as primary evidence, **2h assignment**, **48–72h resolution** SLA — not evidenced as dedicated dispute-media pipeline. |
| **Cancellation / refunds / goodwill** | Policy described in PRD | **Goodwill Credits**, **full timing matrix** for host cancel (72h / 48–72 / 24–48 / &lt;24h) — need explicit product rules in DB/functions if not already. |
| **KYC Tier 1 (surface)** | KYC flow (`app/kyc/`), ID + liveness upload (`lib/verification/submitVerification.ts`), storage, admin review, `verification_events`, vendor webhook (`supabase/functions/kyc-webhook/`) | PRD: Smile ID / Youverify auto — **integrate vendor** and retire “vendor pending”-only path in analysis metadata. |
| **KYC Tier 2** | Not implemented | PRD: **BVN**, high-value &gt; ₦5M, **Pattern C** — **gap**. |
| **Verification gating** | `requiresVerificationGate`, hard gates on create plan / offers / escrow paths | Matches PRD “defer KYC until paid action”; discover browse ungated. |
| **Messaging** | Thread UI (`app/chat/[id].tsx`), conversations/messages schema, realtime | PRD: **E2E Signal-protocol** — treat as **gap** (platform likely uses standard Supabase messages). |
| **Contact-sharing control** | Heuristic moderation (`supabase/functions/moderation-check/`, `lib/ai.ts` patterns); **no** full strike ladder | PRD Sections 12.2–12.3: regex block for NG numbers, WhatsApp, email, NLP soft flag, **1st/2nd/3rd/4th strike** — **major gap**. |
| **Safety / trust** | Reports (`reports` table, `ReportSheet`), moderation logs, admin tabs, plan `is_suppressed`, notifications for admins | Matches anti-fraud/reporting direction; not full PRD physical safety (SOS = Phase 2). |
| **Notifications** | In-app inbox (`app/notifications.tsx`, `create_notification`, triggers), push path (`push-on-notification`), categories & deep links (`lib/notifications/*`) | PRD: keep push **generic** — already consistent with trust work. |
| **Premium** | Premium checkout (`app/premium/`), Paystack premium webhook, boost (`lib/premium/boostPlan.ts`), saved plans, `feed_filters`, travel settings (`app/settings/travel.tsx`) | PRD Premium: **Undo swipe**, **see who’s interested**, **profile spotlight**, **priority dispute queue**, **extended plan visibility** — partly **missing**. |
| **Support** | Support screen (`app/support.tsx`), tickets table | PRD FAQ depth / floating help — **partial**. |
| **Admin** | Admin dashboard: KYC queue + events + signed URLs, reports, moderation, disputes, support (`app/admin/index.tsx`) | Strong for MVP ops; dispute **video evidence tooling** still PRD stretch. |
| **Presence & typing** | `PresenceContext`, typing indicators, `user_presence` | Aligns with “in-app coordination.” |
| **Monetisation hooks** | Escrow + premium + boost | PRD **5–7% platform fee at release**, **wallet withdrawal fee** — confirm implemented in release/refund logic vs marketing copy only. |

---

## 3. Necessary features to add (gaps vs PRD MVP / Phase 1)

Grouped by PRD section. **Priority** follows PRD “Phase 1: Foundation — Months 1–3” where possible.

### 3.1 Meet types & Mood Plans (Section 5)

- **Meet type taxonomy** (dinner, casual, gym buddy, mood, etc.) with duration defaults and **escrow pattern eligibility** (e.g. mutual preferred for gym).
- **Mood Plans:** toggle at creation, **time window**, **auto-expiry**, **urgency badge + countdown** on discover, shortened negotiation rules, **1h funding** deadline after agreement, expiry notifications.
- **Plan card metadata:** meet type tag, **budget tier**, **escrow pattern indicator** (A/B/C).

### 3.2 Escrow patterns (PRD §6.2 vs codebase) — **expanded**

#### What the PRD defines

| Pattern | Name | Who funds | When / guardrails |
|--------|------|-----------|-------------------|
| **A** | Primary (default) | **Host** funds 100% after both sign | All standard meet types; default if host does not opt into mutual |
| **B** | Mutual contribution | **Host + Guest** each pay an agreed split | Host enables at **plan creation**; split visible before offer; both confirm in agreement; **not** for companionship/adult arrangement types |
| **C** | Guest-funded (companionship) | **Guest** funds 100% | **Only** eligible plan types; **KYC Tier 2** required for both parties |

Supporting rules in the PRD (same section / §6.4): NGN locked at agreement; mutual confirmation or 24h auto-release; mutual plans track **per-party shares** for refund; **5–7% platform fee** at release; **₦50k** MVP minimum; **₦5M** Tier 1 cap; **Tier 2 + BVN** above cap / for Pattern C contexts.

#### What the codebase implements today

- **Data model:** `public.escrow_transactions` has a **single** monetary amount (`amount_cents`), one `payer_id`, one `payee_id`, and optional `metadata` JSON (`supabase/migrations/20240406120000_linkup_init.sql`). There is **no** `escrow_pattern` (A/B/C), **no** split fields, and **no** second row or sub-wallet abstraction for two payers.
- **Who pays today:** On `proceedToSecurePayment`, the app inserts `payer_id: offer.bidder_id` and `payee_id: plan.creator_id` (`lib/plans/planAgreementActions.ts`). So the **accepted offer’s bidder (Guest)** is the **payer**, and the **plan creator (Host)** is the **payee**. The escrow screen only shows **Fund escrow** to the user who matches `payer_id` (`app/escrow/[id].tsx`).
- **Funding rail:** One Paystack checkout per escrow (`lib/escrow/openEscrowCheckout.ts`); webhook `paystack-webhook-escrow` verifies reference + metadata and moves `pending_funding` → `funded` (`supabase/functions/paystack-webhook-escrow/index.ts`).
- **Lifecycle (simplified vs PRD):** Client helpers mark plan completed and release escrow (`lib/escrow/escrowActions.ts` — `confirmMeetupComplete`, `releaseEscrowFunds`). There is **no** encoded 24h auto-release job, attendance confirmation window, or cancellation matrix in these modules — treat as **product/backend follow-up** to match §6.3 / §8.

#### Gap summary (PRD → work to do)

1. **Funding-role alignment:** PRD **Pattern A** = **Host** pays **Guest** (commitment from host). Current code = **Guest** pays **Host**. Reconciliation options: (a) swap `payer_id`/`payee_id` assignment + all copy (“Fund escrow” host flow) to match Pattern A, or (b) formally adopt guest-pays-host as MVP and **update PRD** — but that contradicts §4.1 and the strategic narrative unless scoped to specific plan types only (PRD Pattern C).
2. **Pattern B:** New plan fields (e.g. `escrow_pattern`, `host_share_bps` or explicit cent amounts); either **two** escrow rows, one composite row with JSON splits + two Paystack charges, or a ledger table; agreement UI to confirm split; webhook idempotency per contributor; refund logic per share (§8.3).
3. **Pattern C (as PRD):** Restrict to plan category + **Tier 2**; ensure payer/recipient and release rules match legal copy; may overlap with fixing (1) depending on product choice.
4. **Guardrails:** Enforce min/max amounts at agreement/insert; compute and record **platform fee** on release (and **Goodwill Credits** per §8.4 if tied to refunds); server-enforce NGN lock — not only client display.

#### Implementation pointers (for tickets)

| Topic | Likely touchpoints |
|--------|-------------------|
| Payer/host assignment | `lib/plans/planAgreementActions.ts`, `app/escrow/[id].tsx`, any copy in `components/escrow/*` |
| Pattern + splits schema | New migration on `plans` / `escrow_transactions` (or child `escrow_contributions`) |
| Double funding | `openEscrowCheckout.ts`, `paystack-webhook-escrow`, Paystack metadata shape |
| Release & fees | `releaseEscrowFunds`, DB trigger or Edge Function on `released`, accounting for net payee amount |

### 3.3 Legal / policy UX (Sections 8–9)

- **Cancellation matrix** enforced in backend (host timing bands, guest cancel / no-show, mutual-plan variant).
- **Goodwill Credit** ledger (non-cash, 60-day expiry, fee offset).
- **Mandatory pre-agreement modal** after both sign, with **non-dismissible** confirm, **per-user timestamp**, and amounts derived from agreed escrow.

### 3.4 Disputes (Section 10)

- **In-app dispute video** capture with **server timestamp**, optional GPS, identity linkage; storage retention policy (PRD: 90 days post-resolution).
- **Dispute categories** and **evidence ordering** in admin tooling; optional **party messaging** with dispute team (PRD).


### 3.5 Contact & communication policy (Section 12)

- **Message send interceptor** for Nigerian phone formats, WhatsApp/Telegram/IG handles, emails; **hard block** + user warning.
- **Strike system** (1st warning → final warning → 7-day suspension → ban) persisted per user.
- **Post-completion** allowance: unlock off-platform contact only after **mutual completion** (state machine hook).

### 3.6 Discover & Premium (Section 13.3)

- **List view** alternative to swipe.
- **Mood strip** at top of discover.
- Premium: **who viewed / interested**, **undo last swipe**, **profile spotlight**, **longer plan visibility**, **priority dispute handling** (queue flag).

### 3.7 KYC Tier 2 (PRD Sections 7.2, 6.4, Phase 2 in roadmap — but required for Pattern C / high escrow)

- **BVN** (masked storage), elevated tier flag, gates for **&gt; ₦5M** and **companionship / Pattern C**.

### 3.8 Wallet (PRD contradiction)

- Section **13.2** lists “LinkUp Wallet” as Tier 1; **Section 18 Phase 2** lists wallet + withdrawal. Treat as **product decision:** either move wallet to Phase 2 in spec or implement ledger + withdrawal in MVP.

### 3.9 Technical / compliance (Section 16)

- **Immutable financial audit trail** (append-only or event table) if not fully covered by current `escrow_transactions` + Paystack idempotency.
- **Daily reconciliation** job (ops — may be outside app repo).

---

## 4. Already deferred by PRD (Phase 2+)

These are **not** MVP gaps if you follow the internal roadmap in Section 18:

- Recurring / periodic escrow **renewal cycles** (weekly/monthly) as automated products.
- **USSD** payment path.
- **Image OCR** for contact info in photos.
- **SOS / live location** share.
- **Ratings & reputation** post-meetup.
- **LinkUp for Business**, third-party venue APIs, **international** travel/cities.

---

## 5. How to use this doc

- **Engineering:** Use Section 3 as epic backlog; break into migrations + API + UI tickets.
- **Product:** Reconcile PRD **wallet** Tier 1 vs Phase 2; confirm **escrow fee** and **min/max** amounts for launch.
- **Compliance:** KYC partner contracts (Smile ID / Youverify), NDPR hosting assertions, and legal review of adult-use **positioning** remain outside this repo.

---

## 6. Change log

| Date | Change |
|------|--------|
| 2026-04-06 | Initial PRD v2.0 vs codebase gap analysis from PDF + repo scan. |
| 2026-04-06 | §3.2 rewritten: PRD Patterns A/B/C table, actual `payer_id`/`payee_id` behavior from `planAgreementActions.ts`, schema limits, Paystack single-charge model, divergence from Pattern A, ticket pointers. |
