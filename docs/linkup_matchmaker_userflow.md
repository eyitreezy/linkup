# LinkUp MatchMaker — Complete User Flow & Interaction Design
## Annexure C Implementation Blueprint — v2.1 (Team Decisions Incorporated)

---

## LOCKED DECISIONS

| # | Decision | Resolution |
|---|---|---|
| 1 | Conversation milestone | Any connection not reaching the 21-day threshold. 3 such connections within 60 days triggers 30-day cooldown |
| 2 | Compatibility display | Human-language similarity signals from algorithm and values inputs. Updated silently after healing period |
| 3 | Plan creation consent | Pattern (A/B/C) selected during mutual consent flow — no single proposing party |
| 4 | Age range | 18+ minimum. All existing LinkUp members are eligible |
| 5 | Gender/orientation | Heterosexual/straight only for current Nigeria scope. Sexual orientation is a private dealbreaker filter. Expansion will accommodate broader orientations |
| 6 | Profile photo | Same policy as Discover |
| 7 | Subscription access | Gold and above only. Canonical check: `profiles.host_tier IN ('GOLD', 'PLATINUM')`. Use existing `UpgradeGateContext` pattern. |
| 8 | Re-match policy | Never. Two users who previously connected cannot be matched again — permanent |

---

## NAVIGATION DECISIONS (confirmed)

- **Tab order (web + mobile):** Discover → MatchMaker → Meetr → Messages → Account
- **Saved tab removed from primary navigation** on both platforms
- **Saved relocated to Account screen** — after Edit Profile row, with `IoBookmark` icon, label "Saved plans"
- This is confirmed for both web and mobile

---

## OVERVIEW

MatchMaker is a standalone tab in the primary navigation alongside Discover, Meetr, Messages, and Saved. It is the most regulated meet type on the platform. It is available to **Gold subscription and above** only. Every existing LinkUp member aged 18+ is eligible to subscribe and enter.

The central premise: one person, one connection, one genuine opportunity to build something meaningful.

---

## PHASE 0 — ONBOARDING (Modified)

### 0.1 What Changes in Existing Onboarding

The existing LinkUp onboarding is NOT restructured. One question is added to the existing preferences/interests step to capture communication style — data that will be pre-populated into MatchMaker setup later.

**Addition to onboarding preferences step:**

```
New question (added to existing interests/preferences screen):

"How do you prefer to communicate?"

○ Daily contact — I like staying in touch every day
○ A few times a week — Regular but not daily
○ Flexible — I go with the flow

[This is used to personalise your LinkUp experience]
```

Stored on the user profile. Used to pre-populate MatchMaker values later. No mention of MatchMaker during onboarding — it is a general preference question.

---

## PHASE 1 — MATCHMAKER ENTRY GATES

User taps **MatchMaker** in the primary nav for the first time (or after being removed from pool).

### Gate 1 — Subscription Check

```
Is user on Gold subscription or above?
├── NO → Subscription gate screen
│         "MatchMaker is available to Gold members and above"
│         Shows Gold/Platinum/other tier benefits
│         CTA: "Upgrade to Gold" → /subscription
│         Cannot proceed
│
└── YES → Gate 2
```

### Gate 2 — KYC Check

```
Is user KYC Tier 1 verified?
├── NO → Verification gate screen
│         "MatchMaker requires identity verification"
│         "Your identity is verified before you enter the pool
│          to protect every member's safety and seriousness."
│         CTA: "Complete verification" → /kyc
│         Cannot proceed
│
└── YES → Gate 3
```

### Gate 3 — Intent Declaration (first time only)

```
Has user completed Intent Declaration?
├── NO → Intent Declaration screen
│         (standalone, deliberate, separate from onboarding)
│
│         Heading: "Before you enter MatchMaker"
│
│         Body copy:
│         "MatchMaker is built for one purpose: to help serious-minded
│          individuals find a long-term relationship with the potential
│          for marriage. It is not a casual dating feature, a friendship
│          finder, or an exploratory social tool."
│
│         "One person. One connection. One intention."
│
│         Declaration checkbox (must be ticked to proceed):
│         "I am entering MatchMaker with the sincere intention of finding
│          a long-term relationship with the potential for marriage.
│          I understand that this feature is designed for serious-minded
│          individuals and that my behaviour within MatchMaker will be
│          held to that standard."
│
│         CTA: "I confirm this declaration" (active only when ticked)
│         Back: available — no pressure
│
│         Stored server-side in matchmaker_intents table.
│
└── YES → Gate 4
```

### Gate 4 — Values & Dealbreaker Setup (first time only)

```
Has user completed MatchMaker values setup?
├── NO → Multi-step values screen
│         (pre-populated where possible from existing profile data)
│
│         PRE-POPULATED (no input needed from user):
│         • Location & proximity — from existing profile
│         • Interest tags — from existing onboarding
│         • Communication style — from onboarding addition (Phase 0)
│           (user can review and adjust here)
│
│         NEW QUESTIONS (4 steps, shown in sequence):
│
│         Step 1: Faith & Religion
│         "Does faith matter to you in a relationship?"
│         [Yes — I practice a faith] → select faith
│         [Open — faith is not a deciding factor for me]
│         [Prefer not to say]
│         Optional. Private. Never shown publicly.
│
│         Step 2: Family Goals
│         "What are your goals around having children?"
│         ○ Yes — I want children
│         ○ Open to it
│         ○ No — I do not want children
│         ○ I already have children and am open to more
│         ○ I already have children and am not open to more
│         Private. Never shown publicly.
│
│         Step 3: Pace Preference
│         "How long after connecting do you expect to meet in person?"
│         ○ As soon as the platform allows (21 days minimum)
│         ○ 1 to 2 months
│         ○ 3 to 6 months
│         ○ I take my time — 6 months or more
│         Private. Used for compatibility weighting.
│
│         Step 4: Dealbreakers
│         "Are there any absolute dealbreakers for you?"
│         Private hard filters — profiles not meeting these are
│         silently excluded before any compatibility scoring.
│         Never shown to other users.
│         Available filters:
│         • Faith/religion must match
│         • Family goals alignment required
│         • Must be within [X] km radius
│         • Must be within age range [min] to [max]
│         [Done — these are my dealbreakers]
│
│         CTA: "Save and enter MatchMaker"
│         All inputs private. Stored in matchmaker_values table.
│         Can be updated during Healing Period or from settings.
│
└── YES → MatchMaker Main Screen (Phase 2)
```

---

## PHASE 2 — POOL STATE (No active connection)

### 2.1 MatchMaker Main Screen — Pool State

```
┌─────────────────────────────────────┐
│  💍 MatchMaker                       │
│─────────────────────────────────────│
│                                     │
│  [Profile card — compatibility      │
│   sorted, dealbreakers pre-filtered]│
│                                     │
│  Card shows:                        │
│  • Name, age, general location      │
│  • 2-3 human-language compatibility │
│    signals (e.g. "You share similar │
│    views on family" / "Both prefer  │
│    regular daily contact")          │
│  • Shared interest tags             │
│  • Verified badge                   │
│  • Same photo policy as Discover    │
│                                     │
│  Card does NOT show:                │
│  • Values inputs                    │
│  • Dealbreakers                     │
│  • Connection history               │
│  • Subscription tier                │
│                                     │
│─────────────────────────────────────│
│  [Express Interest]    [Pass]       │
└─────────────────────────────────────┘
```

**Compatibility signals (human-language, not a score):**
Generated from overlap between both users' values inputs, interest tags, activity level, location, and communication style. Examples:
- "You share similar views on starting a family"
- "Both prefer daily communication"
- "Similar faith backgrounds"
- "Close in location — within 8 km"

Signals updated silently after each Healing Period questionnaire.

**Gender filter (current scope):**
MatchMaker operates heterosexual/straight only. Women see men. Men see women.
- Profiles with `gender = NULL` or any value other than `'male'` / `'female'`: excluded from pool entirely
- Non-binary is out of scope for Nigeria MVP — excluded from pool, not surfaced to or from any user
- Incomplete profiles (missing required fields) excluded via `matchmaker_get_pool` RPC pre-filter
- Sexual orientation dealbreaker stored in JSONB for future-proofing but NOT applied in pool query for MVP

**Re-match rule:**
Users who previously had a MatchMaker connection are permanently excluded from each other's discovery pool. This is enforced at the server level before compatibility scoring.


### 2.1b Pool Filter

**Philosophy:** MatchMaker filters are deliberately minimal. The algorithm, dealbreakers, and values setup already do the heavy lifting. Only logistical and ordering filters are exposed — not preference filters that duplicate the values system or encourage shallow browsing.

**Two filters only:**

1. **Distance** — Maximum distance radius (km). Soft filter, not a hard dealbreaker. Session-level only — resets on next app open (same behaviour as Discover). Users without location set cannot use this filter.

2. **Sort by** — Toggle between:
   - "Best match" (default) — compatibility signal overlap, same as current pool sort
   - "Recently joined" — profiles who joined MatchMaker most recently shown first. Surfaces fresh faces and prevents the pool feeling stale.

**Filter state shape:**
```typescript
type MatchMakerFilterState = {
  maxDistanceKm: number | null;   // null = no cap
  sortBy: 'best_match' | 'recently_joined';
  filterActive: boolean;          // true when any non-default value is set
};
```

**Default state:**
```typescript
{
  maxDistanceKm: null,
  sortBy: 'best_match',
  filterActive: false,
}
```

**Position and styling:** Identical to the Discover filter — filter icon button in the toolbar above the pool, same `DiscoverFilterIconButton` style (web) / same `PlansFilterSheet` modal pattern (mobile). When `filterActive` is true, the button shows the same active indicator as Discover.

**Filter sheet copy:**
- Heading: "Filter MatchMaker"
- Distance section: same slider as Discover
- Sort section: two-chip toggle ("Best match" / "Recently joined")
- Footer note: "These filters affect what you see today. Your dealbreakers always apply."
- Clear button: "Clear filters" — resets to defaults
- Apply button: "Apply" — primary gradient CTA

**Important:** Filters are session-level only. They are NOT persisted to the user profile or database. On next session, pool defaults to "Best match" with no distance cap.

---

### 2.2 Express Interest Flow

```
User taps "Express Interest" on a profile
         │
         ▼
Server checks: does this user have an active connection?
├── YES → Interest stored silently
│          Not shown to target until their connection ends
│          (one-active-connection rule enforced server-side)
│
└── NO → Target receives notification:
          "[Name] expressed interest in you on MatchMaker"
          Target sees user's profile in their interests queue
                │
                ▼
         Target options:
         ├── Express Interest back → MUTUAL CONNECTION ESTABLISHED
         │                           (see Phase 3)
         │
         ├── Pass → No notification to original user
         │
         └── No action for 30 days → Interest expires silently
```

### 2.2b Interest Queue + Exclusion Enforcement Order

When a user's active connection ends, the system processes queued interests in this order:

```
1. Connection ends → matchmaker_exclusions row inserted for both parties
2. Query matchmaker_interests for any queued 'pending' interests
   targeting the newly-available user
3. For each queued interest:
   a. Check matchmaker_exclusions — if exclusion exists between
      the two users, set interest status = 'expired' and discard silently
   b. If no exclusion: surface the interest to the newly-available user
      (appears in their interests queue)
4. This order guarantees: exclusion check always runs BEFORE
   surfacing any queued interest
```

This is enforced inside the `matchmaker_end_connection()` RPC — not client-side.

### 2.3 60-Day Re-Affirmation (Pool idle users)

```
Every 60 days — active pool members with no current connection:

In-app prompt:
"Are you still actively seeking a long-term relationship with
 marriage potential? Confirm to remain in the MatchMaker pool."

CANONICAL THREE-OPTION MODEL:

CTA 1 (primary button): "Yes, I am still looking"
  → Remains in pool. 60-day clock resets.

CTA 2 (text link): "Ask me later"
  → Snoozes prompt for 7 days. Prompt reappears on next
    MatchMaker open after snooze expires.

CTA 3 (small text link below): "Remove me from the pool"
  → Quietly removed. No notification to others.
    Can re-enter anytime via "Return to MatchMaker" → Gate 3.

Dismiss / back button:
  → Treated as "Ask me later" (NOT removal). Not punitive.

7 days of complete silence (app not opened or no action):
  → Quietly removed from pool.
  → User receives notification:
    "You have been removed from the MatchMaker pool.
     You can return anytime."
     → Can re-enter via "Return to MatchMaker" → Gate 3.
```

---

## PHASE 3 — ACTIVE CONNECTION JOURNEY

### 3.1 Mutual Connection Established

```
Both users have expressed interest in each other
         │
         ▼
Server creates matchmaker_connections row:
• status = 'active'
• connected_at = now()
• first_message_at = null (clock not yet started)
• plan_unlock_at = null (set when first message sent)

Both users notified:
"You have a new MatchMaker connection with [Name]"

One-active-connection rule now active for both users.
Neither can start a new MatchMaker connection until this one ends.
```

### 3.2 Connection Screen Layout

```
┌─────────────────────────────────────┐
│  ← Back          💍 MatchMaker       │
│─────────────────────────────────────│
│  [Profile photo — same as Discover] │
│  [Name], [Age]   ✓ Verified         │
│  [General location]                 │
│─────────────────────────────────────│
│  🟢 Connected · Day [N]             │
│                                     │
│  Plan window: not yet open          │
│  Opens 21 days after first message  │
│                                     │
│  Compatibility signals:             │
│  "You share similar views on family"│
│  "Both prefer daily contact"        │
│─────────────────────────────────────│
│  Connection Journey                 │
│  ✅ Connected                       │
│  ○  First message (starts clock)    │
│  ○  Day 7 — Shared Activity         │
│  ○  Day 10 — Check-in              │
│  ○  Day 21 — Plan window opens     │
│─────────────────────────────────────│
│  [Open Chat]                        │
│  [Shared Activity] — unlocks day 7  │
│  [I feel ready to meet] — day 10+   │
│  [Create Plan] — day 21+ only       │
│─────────────────────────────────────│
│  [End Connection]  ← always visible │
└─────────────────────────────────────┘
```

### 3.3 21-Day Clock Logic

```
Connection established — clock NOT running
         │
         ▼
First message sent (either party)
         │
         ▼
Clock starts. matchmaker_connections updated:
• first_message_at = now()
• plan_unlock_at = now() + 21 days

Connection screen updates:
"Plan window opens in 21 days"
Visible countdown displayed.

Passive match-holding is disincentivised:
a user who never messages does not benefit from
the clock running.
```

### 3.4 Journey Milestones & Nudges

```
DAY 0 — Connection established
  • Both notified, connection screen available
  • Chat available immediately
  • Clock: not yet started (no first message)

──────────────────────────────────────────────
FIRST MESSAGE SENT — Clock starts
  • Countdown appears: "Plan window opens in 21 days"
──────────────────────────────────────────────

DAY 7 (from connected_at) — Shared Interest Activity unlocks
  • [Shared Activity] button becomes active
  • Both parties independently answer 3 questions
    generated from their shared compatibility signals:
    e.g. "What does your ideal Sunday look like?"
         "What does family mean to you?"
         "What is one thing you need in a relationship to feel safe?"
  • Answers revealed simultaneously ONLY after both submit
  • Neither sees the other's answers before submitting
  • Available once per week throughout the connection
  • Voluntary — no penalty for not participating

──────────────────────────────────────────────
DAY 10 (from connected_at) — Check-in nudge
  System sends in-app prompt to both parties:
  "You have been connected for 10 days. How is the
   conversation going? Your MatchMaker plan window
   opens in [X] days. Take your time — there is no rush."

  If either party has not sent a message in 5+ days,
  a warmer version is sent:
  "Connections grow through conversation. Here is a
   prompt to get things going."
  + curated conversation starter from shared signals

DAY 10+ (from connected_at) — "I feel ready to meet" signal available
  One party taps [I feel ready to meet]
         │
         ▼
  Other party notified:
  "[Name] feels ready to meet. Your MatchMaker plan
   window opens in [X] days. No pressure — the
   decision is mutual and the timing is yours."

  Receiving party options:
  ├── Acknowledge in chat (voluntary)
  ├── Ignore (no consequence, no notification to sender)
  └── Also signal ready (mutual signal noted —
       does NOT unlock plan early. 21-day lock stands.)

  Either party can end the connection at any point,
  including in response to feeling pressured.

──────────────────────────────────────────────
DAY 21 (from first_message_at) — Plan window unlocks
  matchmaker_connections: plan_unlock_at reached

  Both notified:
  "Your MatchMaker plan window is now open. When you
   are both ready — and only when you are both ready —
   create a plan and take your connection into the real world."

  [Create Plan] activates in connection screen.

  Plan creation — mutual consent flow (technical mechanic):
  • ONE party taps [Create Plan] on connection screen
  • They enter a MatchMaker plan proposal screen (wrapper
    over existing plan creation) and set plan details +
    preferred escrow pattern (A, B, or C)
  • Other party receives push notification:
    "[Name] proposed a meetup plan. Review and agree."
  • Receiver reviews plan details and escrow pattern,
    then taps [Agree] or proposes an alternative pattern
  • Standard LinkUp offer-and-agreement flow takes over
    from this point — no custom flow required
  • Standard escrow, cancellation matrix, and dispute
    resolution all apply unchanged
  • plans.matchmaker_connection_id stores the link between
    the plan and the MatchMaker connection row

  No pressure or urgency — the unlock is an opportunity,
  not a deadline.
──────────────────────────────────────────────
```

### 3.5 Post-Meetup Flow

```
MatchMaker plan confirmed as completed
(via standard LinkUp post-meetup confirmation flow)
         │
         ▼
Both parties prompted separately, privately:

"How did you feel about this connection after meeting?"
[Much stronger] [Stronger] [Same] [Weaker] [Not sure yet]

"What quality mattered most to you in this meeting?"
(open short text — private, never shared)

Responses stored in matchmaker_reflection_responses.
Feed into Healing Period questionnaire if connection ends.

         │
         ▼
Both parties independently choose:
├── "Continue this connection"
│    → Return to connection screen
│    → Can create further plans (no 21-day lock for
│       subsequent plans within the same connection)
│
└── "End this connection"
     → Phase 4: End Connection Flow
```

---

## PHASE 4 — END CONNECTION FLOW

```
Either party taps [End Connection]
(permanently visible — one tap from connection screen)
         │
         ▼
Confirmation screen:
"Are you sure you want to end this connection?
 This cannot be undone."
[End connection]    [Go back]

         │
         ▼
Reason selection
(private — product feedback only. NEVER shared. NEVER shown to other party):
○ Not compatible
○ Moving too slowly
○ Not feeling it
○ Personal reasons
○ Other

         │
         ▼
Connection ends immediately for both parties.

Party who ended it sees:
"Your connection has ended. You will enter a
 reflection period now."

Other party receives notification:
"This connection has ended."
No reason given. No indication of who ended it.

Both parties immediately:
• Exit active connection state
• One-active-connection rule releases
• Permanently excluded from being matched again
  (re-match rule: never)
• Cannot be re-matched during Reflection + Healing periods
  (redundant given permanent rule, but reinforced)
• Connection appears in each party's private
  connection history (visible only to themselves)

         │
         ▼
→ Phase 5: Reflection & Healing Period
```

---

## PHASE 5 — REFLECTION & HEALING PERIOD

### 5.1 3-Day Reflection Period

```
MatchMaker tab visual state: calm, muted design
Discovery content: hidden
All other LinkUp features: fully accessible

Platform presents optional prompt (private, never shared):
"What did you learn from this connection?"
(short text input)

Framing:
"Take a moment. Reflect on what you experienced.
 We will be here when you are ready."

This is a feature, not a penalty. A protected space.

After 3 days → Healing Period begins automatically
```

### 5.2 3-Day Healing Period

```
MatchMaker tab visual state: slightly warmer tone
Signals forward movement, not dwelling

5-question preference refinement questionnaire
(private, never shared, never shown to other users):

1. After this connection, how do you feel about the
   pace at which you communicated?

2. Did your expectations around family goals change
   or become clearer?

3. What quality mattered most to you in this connection?

4. Was there anything you wish you had known about
   this person earlier?

5. What do you want to feel differently in your
   next connection?

User may also update during Healing Period:
• Dealbreakers
• Values alignment inputs (faith, family goals,
  pace preference, communication style)

Responses update MatchMaker compatibility profile silently.
Compatibility signals in future discovery pool reflect the update.
User is NOT shown a revised score.

After 3 days (6 days total) → Re-entry screen
```

### 5.3 Re-Entry Screen (Day 6+)

```
"We have updated your MatchMaker profile based on
 what you shared. Ready when you are."

[I am ready to enter MatchMaker]

Must be actively tapped — no automatic re-entry.
No expiry — no pressure.
User can wait as long as needed.

Tapping → Returns to Phase 2 (Pool State)
```

---

## PHASE 6 — GUARDRAILS & EDGE CASES

### 6.0b Interest Queue — User-Facing Behaviour

When User A expresses interest in User B while B has an active connection:
- The queued interest is COMPLETELY SILENT — no indicator shown to either party
- User A sees no "pending" state on B's card (card disappears from pool as usual after swipe)
- User B sees nothing — no notification, no queue indicator
- When B's connection ends: exclusion check runs first (see §2.2b), then interest surfaces in B's queue
- User A is never notified whether their interest surfaced or not

### 6.1 One-Active-Connection State

```
User is in active connection and opens MatchMaker tab:

MatchMaker discovery pool: HIDDEN entirely
The tab shows only the active connection screen.
No profile cards. No browsing. Full focus on the current connection.

All other LinkUp tabs remain fully accessible:
Discover, Meetr, Messages, and Saved are unaffected.
Only the MatchMaker discovery pool is hidden.

MatchMaker tab entry point shows:
"You are connected with [Name]"
[View connection]
[End connection]

No ability to browse, express interest, or see other profiles
until the current connection ends.
```

### 6.2 Rapid Cycler Detection

```
Definition: a connection that does not reach the 21-day threshold
is a "sub-threshold connection".

Trigger: 3 sub-threshold connections ended within any 60-day window

Outcome:
• Admin flag raised (review required — not automatic ban)
• 30-day cooldown applied before pool re-entry
• User shown:
  "Your MatchMaker access is paused for 30 days.
   MatchMaker is built for intentional connections.
   We want to make sure the pool stays that way."
• All other LinkUp features remain fully accessible
• After 30 days: access restored via re-entry screen (Phase 5.3)
```

### 6.3 Contact-Sharing Strike

**Contact-sharing suspension screen (shown when user opens MatchMaker tab during 7-day suspension):**
```
[Same visual shell as cooldown screen — muted tone]
[Warning icon — 48pt — #9B1B4B]
"MatchMaker access suspended"
"Sharing contact information outside the app violates
 MatchMaker policy. Your MatchMaker access is suspended
 for 7 days."
[Progress bar — days remaining of 7-day suspension]
"[N] days remaining"
[Note: All other LinkUp features remain accessible.]
```

### 6.3 Contact-Sharing Strike in MatchMaker

```
User attempts to share external contact information
within MatchMaker chat (phone, WhatsApp, Instagram, etc.):

Standard LinkUp contact-sharing enforcement applies PLUS:
→ Immediate MatchMaker access suspended for 7 days
→ Applies even if this is the user's first general strike
→ User notified:
   "Sharing contact information outside the app violates
    MatchMaker policy. Your MatchMaker access is suspended
    for 7 days. All other LinkUp features remain accessible."
→ Standard platform strike also recorded
→ After 7 days: MatchMaker access restored
```

### 6.4 Misalignment Report

Entry point: connection screen settings menu (⋯ icon top right) → "Report this connection"

```
Single-page report form:
  Heading: "Report a concern"
  Sub: "This is separate from blocking. Use this if you feel
        this connection is not being used with sincere intent."

  Reason options (select one):
  ○ Explicit or inappropriate content
  ○ Pressure or coercion
  ○ Financial solicitation or scam behaviour
  ○ Not using MatchMaker sincerely
  ○ Other

  [Optional short text — max 200 chars]

  [Submit report]

On submit:
→ "Your report has been received." — single confirmation, no detail
→ Report logged internally. No notification to reported user.
→ Single report: no automated action. Logged for admin context.
→ 2+ reports from different connections within 90 days:
   Admin review flag raised (not automatic suspension).
→ Admin confirms pattern → MatchMaker access suspended.
→ Pattern not confirmed → reports remain logged only.
```

### 6.5 Subscription Lapse

```
User's subscription drops below Gold (cancellation, payment failure):

→ User exits MatchMaker pool immediately
→ If in active connection:
   Connection is paused, not ended
   Other party notified:
   "Your connection is temporarily paused. [Name] will need
    to resolve their account to continue."
   Connection resumes if subscription is restored within 14 days
   Connection ends automatically if not restored within 14 days
   Standard End Connection flow applies (Phase 4)
→ User cannot re-enter pool until Gold or above is restored
```

---

## DATABASE TABLES

### New Tables

```sql
-- Intent declaration record
matchmaker_intents (
  user_id UUID REFERENCES profiles(user_id),
  declared_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_reaffirmed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id)
)

-- Private values and dealbreakers
matchmaker_values (
  user_id UUID REFERENCES profiles(user_id),
  faith TEXT NULL,
  family_goals TEXT,         -- enum
  lifestyle_notes TEXT NULL,
  communication_frequency TEXT, -- pre-populated from onboarding
  communication_mode TEXT,
  pace_preference TEXT,
  dealbreakers JSONB,        -- private hard filters
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (user_id)
)

-- Active and historical connections
matchmaker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID REFERENCES profiles(user_id),
  user_b_id UUID REFERENCES profiles(user_id),
  status TEXT,               -- pending_mutual | active | ended
  connected_at TIMESTAMPTZ,
  first_message_at TIMESTAMPTZ NULL,
  plan_unlock_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  first_plan_created_at TIMESTAMPTZ NULL, -- set when first MatchMaker plan is created; unlocks subsequent plans without 21-day lock
  ended_by UUID NULL,        -- internal only, never exposed via API
  end_reason TEXT NULL,      -- internal only
  -- DB constraint: max 1 active connection per user
  -- UNIQUE partial index on (user_a_id) WHERE status='active'
  -- UNIQUE partial index on (user_b_id) WHERE status='active'
)

-- Express interest records
matchmaker_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID,
  to_user_id UUID,
  expressed_at TIMESTAMPTZ,
  status TEXT,               -- pending | accepted | passed | expired
  expires_at TIMESTAMPTZ     -- 30 days from expressed_at
)

-- "I feel ready to meet" signals
matchmaker_ready_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES matchmaker_connections(id),
  signalling_user_id UUID,
  signalled_at TIMESTAMPTZ
)

-- Shared Interest Discovery Activity
matchmaker_shared_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES matchmaker_connections(id),
  week_number INT,
  questions JSONB,
  user_a_answers JSONB NULL, -- revealed only after both submit
  user_b_answers JSONB NULL,
  a_submitted_at TIMESTAMPTZ NULL,
  b_submitted_at TIMESTAMPTZ NULL,
  revealed_at TIMESTAMPTZ NULL
)

-- Post-meetup and healing period responses
matchmaker_reflection_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES matchmaker_connections(id),
  user_id UUID,
  post_meetup_feeling TEXT NULL,
  post_meetup_quality TEXT NULL,
  reflection_period_text TEXT NULL,
  healing_answers JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Nudge deduplication
matchmaker_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES matchmaker_connections(id),
  user_id UUID,
  nudge_type TEXT,  -- day_10_checkin | day_21_unlock | reaffirmation | etc.
  sent_at TIMESTAMPTZ
)

-- Permanent exclusion list (re-match rule)
matchmaker_exclusions (
  user_a_id UUID,
  user_b_id UUID,
  excluded_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_a_id, user_b_id)
)
```

### Modified Existing Tables

```sql
-- Add to profiles:
ALTER TABLE profiles ADD COLUMN communication_style TEXT NULL;
-- Populated from onboarding question addition (Phase 0)

-- Add to users (subscription check):
-- No change needed — subscription_tier already exists
```

---

## NAVIGATION & SCREEN INVENTORY

```
/matchmaker                         — Main tab (pool / active / locked state)
/matchmaker/subscribe               — Subscription gate (Gold required)
/matchmaker/verify                  — KYC gate
/matchmaker/declare                 — Intent Declaration (first entry)
/matchmaker/values                  — Values & Dealbreaker setup (first entry)
/matchmaker/profile/:userId         — MatchMaker profile view
/matchmaker/connection/:id          — Active connection screen
/matchmaker/connection/:id/activity — Shared Interest Activity
/matchmaker/connection/:id/ready    — "I feel ready to meet" signal
/matchmaker/connection/:id/end      — End Connection flow
/matchmaker/reflect                 — Reflection Period screen (3 days)
/matchmaker/heal                    — Healing Period questionnaire (3 days)
/matchmaker/reentry                 — Re-entry screen (day 6+)
/matchmaker/history                 — Private connection history
/matchmaker/suspended               — Suspension / cooldown state screen
/matchmaker/settings                — Update values, dealbreakers, visibility
```

---

## REUSED LINKUP INFRASTRUCTURE

| Feature | Reused From |
|---|---|
| Location & proximity | Existing discover feed |
| Profile prompts & photos | Existing profile system |
| Interest tags | Existing onboarding |
| KYC gate | Existing verification |
| Communication style | Onboarding (new question) |
| Messaging / chat | Existing chat infrastructure |
| Create Plan flow | Existing plan creation |
| Escrow (A/B/C selection) | Existing escrow system |
| Cancellation matrix | Existing cancellation policy |
| Dispute resolution | Existing exigency/dispute system |
| Notifications | Existing notification system |
| Contact-sharing enforcement | Existing regex enforcement |
| Admin review panel | Existing admin dashboard (new tab) |
| Subscription tier check | Existing subscription system |

---

## IMPLEMENTATION PHASES

### Phase 1 — Foundation (MVP)
- Onboarding: add communication style question
- DB schema (all new tables)
- Server-side one-active-connection enforcement (DB unique partial index + RPC)
- Subscription gate (Gold+)
- KYC gate (Tier 1)
- Intent Declaration screen
- Values & Dealbreaker setup (pre-populated where possible)
- MatchMaker pool (basic — no compatibility scoring, just dealbreaker pre-filtering)
- Express Interest + mutual connection creation
- Connection screen with 21-day countdown from first message
- Basic messaging (reuse existing)
- End Connection flow
- Reflection & Healing Period screens
- Re-entry screen

### Phase 2 — Intelligence & Journey
- Compatibility scoring algorithm from values signals
- Human-language compatibility signal generation
- Shared Interest Discovery Activity
- 10-day check-in nudge with conversation starters
- "I feel ready to meet" signal
- Post-meetup reflection prompt
- Healing Period questionnaire → silent compatibility profile update
- 60-day re-affirmation system

### Phase 3 — Guardrails & Polish
- Rapid cycler detection + 30-day cooldown
- Contact-sharing MatchMaker-specific 7-day suspension
- Misalignment report flow
- Profile visibility control (MatchMaker pool vs general Discover)
- Private connection history screen
- Subscription lapse handling
- Admin panel MatchMaker tab (reports, flagged users, cooldowns)
- Permanent exclusion enforcement (re-match rule)
