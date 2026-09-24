# LinkUp MatchMaker — Complete User Interaction Specification
## Accepted Standard for Feature Integration · v1.0

---

## VISUAL IDENTITY — LOCKED

| Token | Value | Usage |
|---|---|---|
| Primary (web) | `#6C63FF` | Web CTAs, active states — matches `--primary` in globals.css |
| Primary (mobile) | `#5E52FF` | Mobile CTAs — matches `colors.primary` in constants/theme.ts |
| MatchMaker Accent | `#9B1B4B` | Same on both platforms — the only new token introduced |
| MatchMaker Accent | `#9B1B4B` | Hearts, connection indicators, emotional moments |
| Background (warm) | `#FDF8F4` | All MatchMaker screen backgrounds |
| Surface | `#FFFFFF` | Cards, modals, input fields |
| Surface warm | `#FBF5F0` | Secondary card surfaces, note boxes |
| Border | `#EDE0D4` | Card borders, dividers |
| Text primary | `#1A1D26` | Headings, body text — matches LinkUp `--foreground` |
| Text muted | `#7B6E65` | Captions, timestamps, secondary labels |
| Disabled | `#C8BDB8` | Greyed-out states |

**Animation standard — all MatchMaker screen transitions:**
- Entry: cool slide-in from right, `320ms`, ease-out cubic bezier `(0.25, 0.46, 0.45, 0.94)`
- Exit: slide out to left, `280ms`, same easing
- Modal / bottom sheet: slide up from bottom, `300ms`, spring damping
- Card swipe: physics-based follow with resistance at edges
- Micro-interactions: `200ms` ease-in-out for state changes (button press, icon tap)

**Tab icon:** Flat SVG — heart shape with an elliptical orbital ring crossing in front and behind it. Same stroke weight as existing Ionicons tab icons (1.5pt inactive, 2pt active). No fill on heart in inactive state; `#9B1B4B` fill at 15% opacity on heart in active state. Orbital ring back arc at 35% opacity. Both arcs and heart stroke use `currentColor`.

Created as `MatchMakerTabIcon` component — not an Ionicons icon. Label: **MatchMaker**. Active colour: `#9B1B4B`. Inactive: standard tab inactive muted colour.


---

## PART 0 — ONBOARDING ADDITION (Detailed)

### 0.0 Context — What the Existing Onboarding Collects

The existing LinkUp 5-step onboarding collects the following fields that MatchMaker reuses:

| Field | Onboarding Step | MatchMaker Usage |
|---|---|---|
| `display_name` | Step 1 | Shown on MatchMaker profile card and full profile view |
| `birth_date` | Step 1 | Age displayed on card, 18+ enforced at Gate 1 |
| `local_photo_uris` / `remote_photo_urls` | Step 1 | MatchMaker profile photo — same policy as Discover. Primary photo shown on pool card, all photos visible on full profile view |
| `videos` (profile video) | Step 1 | Shown on full MatchMaker profile view — same as Discover profile. Video URL stored as part of profile media, fetched via `fetchUserProfileBundle` |
| `bio` | Step 2 | Shown on full MatchMaker profile view |
| `interests` | Step 2 | Compatibility signal source, shown as interest tag chips on pool cards |
| `languages` | Step 2 | Compatibility signal source — language match weighted in compatibility scoring |
| `meeting_intent` | Step 2 | Pre-existing intent field — MatchMaker adds its own separate intent declaration (Gate 3). The two are independent. |
| `prompt_answers` | Step 2 | Shown on full MatchMaker profile view — same as Discover profile |
| `location` | Step 3 | Pool proximity filtering and dealbreaker radius check. Shown as general area (not exact) on pool cards |
| `verification_status` | Post-onboarding | Gate 2 KYC check — must be `'verified'` |
| `host_tier` | Account | Gate 1 subscription check — `profiles.host_tier IN ('GOLD', 'PLATINUM')`. Use existing `UpgradeGateContext`. `subscription_tier` is not the canonical field. |
| `gender` | **Step 0 (required)** | Pool gender filter. Collected on Step 0 of onboarding alongside display name and photos. Required — blocks Continue if null. Label: "I am". Options: Woman / Man / Non-binary / Prefer not to say. Stored as `'female'` / `'male'` / `'non_binary'` / `'prefer_not_to_say'`. Only `'female'` and `'male'` enter the MatchMaker pool. Web: `GradientChip`. Mobile: `renderChoiceChip` with `PROFILE_GENDER_OPTIONS`. |

**None of the above require changes.** They are read by MatchMaker as-is from the existing profile.

**Important:** A profile must pass `matchmaker_profile_is_pool_eligible` to appear in any pool. This checks that `display_name`, `bio`, `latitude`, `longitude`, `photo_urls` (at least one), and `preferences->'interests'` (non-empty array) are all set. Profiles missing any of these are excluded silently. Users should be encouraged to complete their full profile before entering MatchMaker.

**Gender is required on Step 0 — not optional:**
- Mobile: gender field moved to Step 0 (was incorrectly on Step 2). Added to `canContinue1` as a required condition. The Continue button on Step 0 remains disabled until a gender chip is selected.
- Web: gender field added to Step 0 as a `GradientChip` group. `stepValid` blocks Continue until selection is made.
- Existing users with `profiles.gender = NULL` see the `gender_not_set` gate modal when opening MatchMaker. CTA routes to `/settings/edit-profile`.

### 0.1 The One Field Added to Onboarding

**Field:** `communication_style TEXT NULL` — added to the `profiles` table.

**Where it appears:** Step 4 of 5 (interests/preferences step), as a new section immediately below the interest tag selector. It does NOT appear as a new step — it is embedded in the existing step to preserve the 5-step structure and avoid increasing perceived onboarding length.

**Question copy:**
- Heading: "How do you prefer to communicate?"
- Sub-label: "Helps us personalise your LinkUp experience" — no MatchMaker mention
- Options (single select, stored as string values):
  - `"daily"` → "Daily contact, I like staying in touch regularly"
  - `"few_times_week"` → "A few times a week, Regular but not every day"
  - `"flexible"` → "Flexible, I go with the flow"

**Behaviour:**
- Selection is optional — user can tap Continue without selecting
- If selected: `profiles.communication_style` updated immediately via `autosaveOnboardingProgress`
- If skipped: field remains `NULL`. MatchMaker Gate 4 (values setup) will surface the question as a required input instead
- This field is also editable from: MatchMaker Settings → My Values → Communication style

**Implementation files to modify (web):**
- `src/features/onboarding/OnboardingScreen.tsx` — add communication style selector after interest tags in Step 4 render
- `src/lib/onboarding/constants.ts` — no change needed (ONBOARDING_TOTAL_STEPS stays 5)
- `src/lib/onboarding/persist.ts` — `saveOnboardingStep` already handles arbitrary profile fields; pass `communication_style`
- `src/types/onboarding.ts` — add `communication_style` to `OnboardingDraft` type

**Implementation files to modify (mobile):**
- `app/onboarding/index.tsx` — add communication style selector after interest tags in the Step 4 / `canContinue2` section
- `lib/onboarding/draft.ts` (or equivalent) — add `communicationStyle` to draft state
- Migration: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS communication_style TEXT NULL;`

### 0.2 Fields Collected ONLY During MatchMaker Gate 4 (Values Setup)

These fields are never collected during general onboarding. They are private, MatchMaker-specific, and stored in the `matchmaker_values` table — not on `profiles`.

| Field | DB Column | Type | Private |
|---|---|---|---|
| Faith preference | `faith` | `TEXT NULL` | Yes — never shown |
| Family goals | `family_goals` | `TEXT NOT NULL` | Yes — never shown |
| Pace preference | `pace_preference` | `TEXT NOT NULL` | Yes — used for compatibility weighting |
| Dealbreakers | `dealbreakers` | `JSONB` | Yes — silent hard filters |
| Communication style (if null from onboarding) | `communication_frequency` | `TEXT NULL` | Yes |

### 0.3 Gate 4 Pre-Population Logic

When a user reaches Gate 4 (Values Setup) for the first time:

```
IF profiles.communication_style IS NOT NULL:
  → Show review card at top of Step 1:
    "From your LinkUp profile: Communication style: [value]"
    [Edit] link → scrolls to inline selector to update
  → communication_frequency in matchmaker_values is pre-set to match

IF profiles.communication_style IS NULL:
  → No review card shown
  → Communication style selector appears as a standard required
    input within Step 1 of Gate 4
  → On save: both profiles.communication_style AND
    matchmaker_values.communication_frequency are updated
```


---

### Navigation Placement — MatchMaker Tab

**Both web and mobile:**
- MatchMaker tab is placed **immediately to the right of the Discover tab** in the primary navigation
- New tab order: **Discover → MatchMaker → Meetr → Messages → [Account]**
- The **Saved tab is removed from the primary navigation** on both platforms
- Saved is relocated to the **Account screen**, positioned after Edit Profile, with a bookmark icon (`IoBookmark` / `Ionicons bookmark-outline`)
- On web: Saved appears as a menu item in the left sidebar account section
- On mobile: Saved appears as a row in the Profile/Account tab screen, after Edit Profile

This affects:
- Web: `src/components/navigation/` — tab bar / sidebar component
- Mobile: `app/(tabs)/_layout.tsx` — tab navigator configuration
- Mobile: `app/(tabs)/profile.tsx` or equivalent Account screen — add Saved entry

---

## PART 1 — ENTRY & ONBOARDING

### 1.1 First Tap — MatchMaker Tab

**Scenario A: User does not meet entry requirements**

User taps MatchMaker tab for the first time.

```
Screen slides in from right.

Gate check runs in sequence (server-side, single round trip):
1. Subscription tier (Gold+)
2. KYC status (Tier 1 verified)
3. Intent declaration (completed)
4. Values setup (completed)

The FIRST failing gate is shown. User resolves it and returns.
```

**Gate pattern — ALL gates (subscription, KYC, cooldown, suspension):**

The MatchMaker tab is always accessible in the navigation. When a gate is not met:
1. User lands on the MatchMaker screen
2. Real pool profiles (up to 6) are fetched and rendered beneath a blur
3. A non-closeable modal sits above the blur with dynamic content
4. Blurred content has pointer-events disabled — cannot be interacted with
5. Intent Declaration and Values Setup use full-screen overlays (no blur)

**Modal content by gate state:**

| Gate | Icon | Heading | Body | CTA |
|---|---|---|---|---|
| Subscription | Ring-heart `#9B1B4B` | "MatchMaker is a Gold feature and above" | "Upgrade to Gold or a subscription plan higher than Gold to access intentional matchmaking designed for people serious about finding a long-term relationship." | "Upgrade to Gold" → /subscription |
| KYC | Shield checkmark `#6C63FF` | "Verify your identity first" | "MatchMaker requires identity verification before you enter the pool, to protect you and every other member." | "Complete verification" → /kyc |
| Cooldown | Clock `#7B6E65` | "MatchMaker is paused for [N] days" | "MatchMaker is built for intentional connections. Your access resumes on [date]." | "Got it" → modal collapses to persistent banner |
| Suspension | Warning `#9B1B4B` | "MatchMaker access suspended" | "Your MatchMaker access is suspended for [N] days due to a contact-sharing policy violation. All other LinkUp features remain accessible." | "Got it" → modal collapses to persistent banner |

**After "Got it" (cooldown/suspension):**
Modal collapses. A persistent amber banner appears at the top of the still-blurred screen:
`[Clock icon]  "MatchMaker resumes in [N] days"  [Days pill]`
Pool stays blurred and non-interactive.

**Modal rules:**
- No X button
- No dismiss gesture
- No tap-outside-to-close
- `onRequestClose` is intentionally empty (mobile)
- Subscription and KYC modals: not dismissible under any circumstance — user must take the CTA action

---

### 1.2 Intent Declaration Screen (first time only)

Slides in. Warm background. No header navigation bar — this screen demands full attention.

**Layout (top to bottom):**
```
[Ring-heart icon — 56pt — #9B1B4B — centred]

[Spacing: 32pt]

"Before you enter MatchMaker"
[24pt — bold — #1A1A2E — centred]

[Spacing: 16pt]

"MatchMaker is built for one purpose: to help
 serious-minded individuals find a long-term
 relationship with the potential for marriage."

[Spacing: 8pt]

"It is not a casual dating feature, a friendship
 finder, or an exploratory social tool."

[Spacing: 24pt]

[Warm surface card — rounded 16pt — border #EDE0D4]
  "One person. One connection. One intention."
  [16pt — italic — #9B1B4B — centred]

[Spacing: 32pt]

[Declaration checkbox card — rounded 16pt — surface white]
  [Checkbox left — unticked by default]
  "I am entering MatchMaker with the sincere
   intention of finding a long-term relationship
   with the potential for marriage. I understand
   that this feature is designed for serious-minded
   individuals and that my behaviour within
   MatchMaker will be held to that standard."
  [14pt — #1A1A2E]

[Spacing: 24pt]

[CTA — "I confirm this declaration"]
  Disabled (greyed) until checkbox ticked.
  On tick: button colour transitions from disabled
  to primary gradient over 200ms.
  On tap: brief haptic (medium impact), then proceeds.

[Spacing: 16pt]

[Text link — "Go back" — centred — #7B6E65]
```

**Behaviour:**
- Checkbox tap: haptic (light), checkbox animates to ticked state (spring, 200ms)
- CTA becomes active on tick — no other interaction enables it
- On CTA tap: screen slides out, next gate evaluates
- Declaration stored server-side immediately on tap — not on completion of all gates

---

### 1.3 Values & Dealbreaker Setup (first time only)

Multi-step flow. 4 steps. Back navigation available on all steps.

**Container:**
- Web: each step renders inside a `FormCard` component — `rounded-3xl p-[2px] linkup-gradient-primary` outer ring, `rounded-[22px] bg-white p-5` inner. Same component used in onboarding and settings.
- Mobile: each step renders inside a `stepCard` — `backgroundColor: onboarding.cardBg`, `borderRadius: radius.xl`, `padding: spacing.md`, `borderWidth: 1`, `borderColor: onboarding.glassBorder`, shadow from `onboarding.shadow`.

**Progress indicator:**
- Web: `StepProgress` component (same as KYC wizard) — "Step N of 4" left, percentage right, `h-2 rounded-full bg-[#EDE8FF]` track + `linkup-gradient-primary` fill bar.
- Mobile: `OnboardingStickyProgress` component — same as main onboarding.

---

**Step 1: Faith and Religion**

Pre-population review card (shown above question if `profiles.communication_style` is set):
- Web: `div` with `rounded-2xl bg-[#F5F6FA] px-4 py-3 flex items-center justify-between mb-4`
  ```tsx
  <div className="flex items-center justify-between rounded-2xl bg-[#F5F6FA] px-4 py-3 mb-4">
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">From your LinkUp profile</p>
      <p className="text-[14px] font-extrabold text-foreground">Communication style: [value]</p>
    </div>
    <button className="text-[12px] font-extrabold text-primary">Edit</button>
  </div>
  ```
- Mobile: `stepCard` with reduced padding, `rowBetween` layout inside:
  ```tsx
  <View style={[styles.stepCard, { padding: spacing.sm, marginBottom: spacing.md }]}>
    <View style={styles.rowBetween}>
      <View>
        <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase' }}>
          FROM YOUR LINKUP PROFILE
        </Text>
        <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: colors.text }}>
          Communication style: [value]
        </Text>
      </View>
      <Pressable onPress={handleEditCommStyle}>
        <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.primary }}>Edit</Text>
      </Pressable>
    </View>
  </View>
  ```

Question heading: `font-display text-[18px] font-extrabold text-foreground` (web) / `fontSize: 18, fontFamily: fonts.bold, color: colors.text` (mobile)
Question text: "Does faith matter to you in a relationship?"

Private label beneath heading: `text-[13px] font-semibold text-muted` (web) / `fontSize: 14, fontFamily: fonts.medium, color: colors.textMuted` (mobile)
Private label text: "This is private and never shown to others."

Options use the SAME chip pattern as `meetingIntent` in onboarding:
- Web: `GradientChip` component — `rounded-full border-2 px-4 py-2 text-[13px] font-extrabold`. Selected: `border-transparent linkup-gradient-primary text-white`. Idle: `border-border bg-white text-primary`. Wrapped in `flex flex-wrap gap-2`.
- Mobile: `renderChoiceChip` — selected: `LinearGradient([colors.primary, '#8B7CE8', colors.secondary])`. Idle: `backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: 'rgba(94,82,255,0.22)'`. Wrapped in `intentRow` style.

Options:
```
"Yes, faith is important to me"   [expands faith-type chips below when selected]
"Open, faith is not a deciding factor for me"
"Prefer not to say"
```

When "Yes, faith is important to me" selected, second chip group expands below in new wrapped row:
```
"Christianity"   "Islam"   "Other faith"   "Prefer not to specify"
```

When "Other faith" is selected from this second row:
- A text input appears immediately below the chips
- Web: standard `Input` component using `onboardingFieldClass`
- Mobile: `Input` with `variant="onboarding"`
- Label: "Please specify your faith" (12px, muted, extrabold)
- Placeholder: "e.g. Hinduism, Buddhism, Sikhism..."
- Max 50 characters. Character counter shown right-aligned below input: "[N]/50"
- Mandatory: Continue is blocked until this field has at least 1 character
- Saved as `other:[user text]` in the faith value field

CTA: `Continue` — `linkup-gradient-primary rounded-full min-h-[48px] w-full font-extrabold` (web) / `Button gradient pill` (mobile). Active only when a primary option is selected.

---

**Step 2: Family Goals**

Same chip pattern as Step 1. Single select only.
Question: "What are your goals around children?"
Private label: "Private. Never shown publicly."

Options (chips, wrapped row):
```
"Yes, I want children"
"Open to it"
"No, I do not want children"
"I have children and am open to more"
"I have children, but I am not open to more"
```

CTA: `Continue` — active when one chip is selected.

---

**Step 3: Pace Preference**

Same chip pattern. Single select.
Question: "How long after connecting do you expect to meet?"
Private label: "Private. Used for compatibility weighting only."

Options (chips, wrapped row):
```
"As soon as the platform allows (21 day minimum)"
"1 to 2 months"
"3 to 6 months"
"I take my time, 6 months or more"
```

CTA: `Continue` — active when one chip is selected.

---

**Step 4: Dealbreakers**

IMPORTANT: This step is NOT optional and must always render after Step 3. Do not gate or skip it.

Question: "Are there absolute dealbreakers for you?"
Sub-label: "Private hard filters. Profiles that do not meet them are silently excluded before you see them. Never disclosed to anyone."

Uses toggle pattern — same as `ToggleRow` (web) / `rowBetween` + `Switch` (mobile) used in onboarding:

- Web: `ToggleRow` component for each item
  ```tsx
  // flex items-center justify-between gap-4 border-b border-border/50 py-3.5
  // ToggleSwitch: h-7 w-12 rounded-full, linkup-gradient-primary when on, bg-[#E8E4F5] when off
  <ToggleRow label="Faith alignment must match" checked={db.faith} onChange={v => setDb(d => ({...d, faith: v}))} />
  <ToggleRow label="Family goals must align" checked={db.family} onChange={v => setDb(d => ({...d, family: v}))} />
  <ToggleRow label="Must be within distance range" checked={db.location} onChange={v => setDb(d => ({...d, location: v}))} />
  <ToggleRow label="Must be within age range" checked={db.age} onChange={v => setDb(d => ({...d, age: v}))} />
  ```
  When "Must be within distance range" is toggled on: distance input or slider appears below.
  When "Must be within age range" is toggled on: min/max age number inputs appear below.

- Mobile: `rowBetween` + native `Switch`
  ```tsx
  // rowBetween: flexDirection: 'row', alignItems: 'center',
  //             justifyContent: 'space-between', marginBottom: spacing.lg
  // switchLabel: fontSize: 15, fontWeight: '700', fontFamily: fonts.medium,
  //              color: colors.text, flex: 1
  // Switch trackColor={{ true: colors.primary }}
  <View style={styles.rowBetween}>
    <Text style={styles.switchLabel}>Faith alignment must match</Text>
    <Switch value={db.faith} onValueChange={v => setDb(d => ({...d, faith: v}))}
      trackColor={{ true: colors.primary }} />
  </View>
  // Repeat for family, location, age
  ```

**Other dealbreakers (tag-input):**

After the four standard toggle rows, an "Other dealbreakers" toggle is shown:
```
Other dealbreakers     [Toggle]
Add your own specific requirements
```

When toggled on, a tag-input container appears below:
```
[Container — warm surface #FBF5F0, border #EDE0D4, rounded-2xl]

"Your dealbreakers"
"Add specific requirements that matter to you. Max 10."

[Tags row — chips with X delete button, pill style]
  [Tag 1: "Must not smoke" [x]]
  [Tag 2: "Must be employed" [x]]

[Input field + Add button row]
  [Input — "e.g. Must not smoke..."] [Add]
  [Character counter right: 0/60]

[When max 10 reached: "Maximum of 10 dealbreakers reached." — no input shown]
```

Tag behaviour:
- Type in input, press Enter (mobile: submit keyboard) or tap Add to create tag
- Each tag is a pill chip with a close/remove button (IoClose / Ionicons close)
- Max 10 tags total
- Max 60 characters per tag
- Duplicate tags not allowed (Add disabled if tag already exists)
- Saved as `dealbreakers.other: [array of strings]` in the values payload

CTA: "Save and enter MatchMaker" — always active (dealbreakers are optional). `linkup-gradient-primary rounded-full min-h-[48px] w-full font-extrabold` (web) / `Button gradient pill fullWidth` (mobile).
---

## PART 2 — POOL STATE

### 2.1 MatchMaker Main Screen — Pool State

**Screen layout:**
```
[Status bar]
[MatchMaker header — warm background]
  [Heart-ring icon — #9B1B4B — left]  MatchMaker  [Settings gear — right]

[Card stack area — takes 72% of screen height]
  [Current profile card — centred, slight shadow]
  [Next card visible behind — scaled 96%, offset 8pt down]
  [Third card barely visible — scaled 92%, offset 16pt down]

[Action row — bottom 28% of screen]
  [Pass button]  [Express Interest button]
  or
  [Swipe left = Pass, Swipe right = Express Interest]
```

**Mobile — card stack (Discover-style swipe):**

Profile card dimensions: full width minus 32pt margin each side. Rounded corners 20pt. White surface. Drop shadow `rgba(155, 27, 75, 0.08)` — subtle warm shadow.

Card content:
```
[Photo — top 55% of card — rounded top corners]

[Content area — bottom 45%]
  [Name], [Age]  [Verified badge if applicable]
  [Location — muted]

  [Compatibility signals — 2 to 3 chips]
    Each chip: warm surface #FBF5F0, border #EDE0D4
    Text: "#9B1B4B" — 12pt — semi-bold
    Examples:
    "Similar family goals"
    "Both prefer daily contact"
    "Close in location"

  [Interest tags — horizontal scroll — same chip style as main app]

  [Spacing: auto]

  ["View full profile" — text link — right aligned — #6C63FF]
```

**TWO SEPARATE CLOCKS — explicitly stated:**
- Day 7, Day 10, and the connection screen "Day N" display count from `connected_at`
- Plan window unlock counts from `first_message_at + 21 days`
- A user who never messages will unlock Day 7/10 milestones but can never unlock the plan window
- Connection screen day counter uses `connected_at` as anchor

**Swipe interactions (mobile):**
- Swipe right: card rotates clockwise 8deg, green tint overlay fades in with heart icon, releases with spring animation off screen right. Express Interest registered.
- Swipe left: card rotates counter-clockwise 8deg, muted tint overlay fades in with X icon, releases off screen left. Pass registered.
- Swipe up: card flies upward — no action assigned (dead zone, card snaps back)
- Partial swipe: card follows finger with spring resistance. On release below threshold (40% of screen width): snaps back to centre with spring, `300ms`
- On snap-back: subtle haptic (light)
- On full swipe to action: medium haptic

**Button interactions (alternative to swipe):**
- Pass button: circle, 56pt, border `#C8BDB8`, X icon `#7B6E65`
- Express Interest button: circle, 64pt (slightly larger), gradient fill `#6C63FF` to `#9B1B4B`, heart icon white
- Button tap = same outcome as swipe, same haptic, same card animation

**Web — pool layout:**
Grid of profile cards (same style as Discover on web). Each card has Express Interest and Pass buttons at the bottom. No swipe — click-based. Cards load in batches of 12.

---

### 2.2 Express Interest — Confirmation State

After user swipes right or taps Express Interest:

**If target has NO active connection:**
```
Card flies off screen right (mobile) / fades out (web).
Brief toast (bottom of screen, 2 seconds):
  [Heart icon — #9B1B4B]  "Interest sent"

Next card slides up from stack with spring animation.

The profile now shows a pending indicator IF the user
sees it again (e.g. if it surfaces again in the pool
before expiry):
  [Pending pill on card — "Interest sent ✓" — #FBF5F0 border #EDE0D4]
```

**If target has an active connection (interest stored silently):**
```
Same animation — no difference to the user.
The interest is stored server-side.
When target's connection ends, the interest surfaces
in their queue automatically.
```

---

### 2.3 Profile View (Full MatchMaker Profile)

User taps "View full profile" link on a card.

Screen slides in from right. Header has back chevron.

```
[Full photo — top 45% — edge to edge]
[Gradient overlay bottom 30% of photo — warm cream fade]

[Content scrolls below]

[Name], [Age]    [Verified badge]
[Location]

[Spacing: 16pt]

[Compatibility section — card — warm surface]
  Heading: "What you have in common"
  [2 to 3 signal lines — each with small icon]
  e.g. "💬 Both prefer regular communication"
       "👨‍👩‍👧 Similar family goals"
       "📍 8 km away"

[Spacing: 16pt]

[Interests section]
  [Tag chips — horizontal wrap]

[Spacing: 16pt]

[Profile prompts — from existing profile setup]
  Each prompt as a card with question and answer
  Same style as main LinkUp profile view
  BUT: only prompts the user added — no empty states

[Spacing: 32pt]

[Action row — fixed bottom]
  [Pass — text button — left]    [Express Interest — primary CTA — right]
```

---

### 2.3b Interest Queue — Exclusion Enforcement Order

When a user's connection ends and queued interests are processed:

1. Exclusion row inserted first (both parties permanently excluded from re-match)
2. System scans pending interests targeting the newly-available user
3. Each queued interest: exclusion check runs BEFORE surfacing
4. If exclusion exists → interest set to `expired`, never shown
5. If no exclusion → surfaces in receiver's interests queue

This is enforced server-side in `matchmaker_end_connection()` RPC only — not client-side.

### 2.3c Interest Queue — No User-Facing Indicator

When a user has an active connection and someone expresses interest in them:
- Completely silent. No badge, no notification, no indicator anywhere in the app.
- The interested party sees no confirmation their interest was queued — card disappears as normal after swipe.
- When the active connection ends: exclusion check runs first, then queued interests surface in the receiver's interests queue automatically.
- Neither party is notified about the queueing or the surfacing — the receiver simply finds new items in their interests queue.

### 2.4 Pending Interests Queue (Received)

User taps the interests icon/tab within MatchMaker (top-right of pool screen, badge count shown).

```
[Screen title: "People who expressed interest"]

[List of profile cards — stacked list view]
  Each card:
  [Thumbnail photo — 56pt circle]
  [Name], [Age], [Location]
  [1 compatibility signal]
  [Express Interest back] [Pass]

[Empty state — if no pending interests]
  "No one has expressed interest yet.
   Keep browsing — your match is in the pool."
```

When user taps Express Interest back → mutual connection established (see Part 3).
When user taps Pass → profile removed from this list, no notification to the other party.

---

### 2.5 60-Day Re-Affirmation Prompt

Shown as a full-screen overlay when user opens MatchMaker tab after 60 days of pool membership with no active connection.

```
[Warm background — full screen]

[Ring-heart icon — centred — 48pt]

[Spacing: 24pt]

"Still looking?"
[22pt — bold]

[Spacing: 12pt]

"You have been in the MatchMaker pool for 60 days.
 We want to make sure you are still actively looking
 for a long-term relationship before keeping your
 profile visible to others."

[Spacing: 32pt]

[CTA — "Yes, I am still looking"]
[Text link — "Remove me from the pool for now"]
```

- "Yes, I am still looking" → overlay dismisses, pool refreshes, clock resets
CANONICAL THREE OPTIONS:
[Primary CTA]: "Yes, I am still looking" → pool stays, clock resets
[Text link]:   "Ask me later" → snoozes 7 days, reappears on next open
[Small link]:  "Remove me from the pool" → silent removal, no notification to others
Dismiss/back button = "Ask me later" (NOT removal)
7 days complete silence = removal + notification: "You have been removed from the MatchMaker pool. You can return anytime." 

---

## PART 3 — ACTIVE CONNECTION JOURNEY

### 3.1 Mutual Connection Established — Notification & Entry

**Notification (both parties receive simultaneously):**
```
Push notification:
[Heart-ring icon]
"You have a new MatchMaker connection"
"[Name] and you expressed mutual interest.
 Your connection has begun."
```

Tapping notification → MatchMaker tab → connection screen slides in.

If user is already in MatchMaker tab when connection is established:
- Pool cards fade out
- Connection screen slides in from right with a soft warm glow transition
- Brief haptic (success — double tap pattern)

---

### 3.2 Connection Screen

The central screen for the entire connection journey. Slides in once and persists until connection ends.

```
[Warm background #FDF8F4]

[Header]
  [Back chevron — returns to MatchMaker tab root]
  [Name] · MatchMaker
  [Settings icon — top right — connection settings]

[Profile section — top]
  [Photo — 88pt circle — centred — warm border ring #9B1B4B 2pt]
  [Name] [Age]    [Verified badge]
  [Location]

[Connection status bar]
  [Warm card — rounded 12pt — border #EDE0D4]
  🟢 Connected, Day [N]
  [If clock running]: "Plan window opens in [X] days"
  [If clock not started]: "Send the first message to start
                           your 21-day journey"

[Compatibility signals — 2 to 3 lines]
  Same chip style as pool cards

[Journey Timeline — vertical stepper]
  Each milestone as a row:

  ✅ Connected             [Date — muted right]
  ○  First message         (starts 21-day plan clock only)
  ○  Day 7 from connected_at — Shared Activity
  ○  Day 10 from connected_at — Check-in
  ○  Day 21 from first_message_at — Plan window opens

  Completed milestones: filled circle, #6C63FF, checkmark icon
  Current milestone: pulsing ring animation, #9B1B4B
  Future milestones: empty circle, #C8BDB8

[Action buttons — stacked — bottom section]
  [Open Chat]                 ← always active
  [Shared Activity]           ← disabled before day 7, active after
  [I feel ready to meet]      ← disabled before day 10, active after
  [Create Plan]               ← disabled until day 21 (from first message)

  Disabled buttons: greyed out (#C8BDB8), tappable with explanation:
  "This unlocks on Day [N]" — shown as a brief tooltip/toast on tap

[End Connection — text link — bottom — muted — always visible]
  #7B6E65 — small — "End this connection"
```

---

### 3.3 Opening Chat from Connection Screen

Tap [Open Chat] → standard LinkUp chat thread slides in.

The chat thread appears inside the Messages tab exactly like any other chat. It is identified by:
- The other person's name
- A subtle MatchMaker badge next to the name: heart-ring icon, 14pt, `#9B1B4B`
- The same warm background tone in the chat header only — message bubbles use standard styling

The chat thread header (when inside Messages tab) shows:
```
[Back]  [Photo]  [Name]  [♥ MatchMaker]  [Connection screen icon]

Tapping [Connection screen icon] → navigates back to connection screen
```

No MatchMaker-specific restrictions inside the chat beyond the existing contact-sharing enforcement.

---

### 3.4 Day 7 — Shared Interest Activity

**Entry point:** [Shared Activity] button becomes active on Day 7. Tapping it slides in the activity screen.

**Activity screen — before either party submits:**
```
[Warm background]

[Header]
  [Back chevron]  "Shared Activity"

[Spacing: 24pt]

[Activity card — large — warm surface — rounded 20pt]
  [Small label: "Week [N] · Question [N]"]

  [Question text — large — centred — 20pt — bold]
  e.g. "What does your ideal Sunday look like?"

[Spacing: 32pt]

[Answer options — stacked selection cards]
  [Option A]
  [Option B]
  [Option C]
  [Option D]

  (Options generated from compatibility signals and
   general lifestyle questions — not binary yes/no)

[Spacing: 24pt]

[Status row]
  Your answer:     [○ not yet submitted]
  [Name]'s answer: [○ waiting for them]

[CTA — "Submit my answer"]
  Disabled until selection made.
  On submit: answer locked, cannot change.
```

**After user submits — waiting for partner:**
```
[Activity card — same question shown]

[Status row updates]
  Your answer:     [✓ submitted]
  [Name]'s answer: [○ still thinking...]

[Subtle animated waiting state — gentle pulse on partner's status dot]

[Body text — centred — muted]
  "We will reveal both answers the moment
   [Name] submits theirs."

[Close button — returns to connection screen]
[Chat shortcut — "Chat while you wait" — text link]
```

**Reveal moment — both submitted:**

Push notification to the waiting party:
```
[Heart-ring icon]
"[Name] answered. See what you both said."
```

Both parties open the activity screen to the reveal:
```
[Reveal animation — 600ms]
  Both answer cards slide in from opposite sides
  and settle side by side (mobile: stacked vertically)

[Your answer card — left / top]
  Label: "You said"
  [Answer text — bold]

[Their answer card — right / bottom]
  Label: "[Name] said"
  [Answer text — bold]

[No match/mismatch celebration — intentionally absent]
[No score, no percentage]

[Below the reveal]
  "You have both answered. Talk about it."
  [italic — muted — centred]

[CTA — "Open chat" — primary]
[Link — "See next question" — if available]
```

The reveal is calm, not gamified. The point is the conversation it starts, not the comparison itself.

**Subsequent weeks:** A new question becomes available each week. Button shows badge count of available questions.

---

### 3.5 Day 10 — Check-In Nudge

Delivered as an in-app notification card inside MatchMaker tab (not a push notification unless app is closed):

```
[Warm notification card — slides down from top of connection screen]

"You have been connected for 10 days."

[If both messaging actively]:
"How is the conversation going? Your plan window
 opens in [X] days. Take your time — there is no rush."

[If either party silent 5+ days]:
"Connections grow through conversation. Here is a
 prompt to get things going:"

[Conversation starter card]
  "Ask [Name]: [generated prompt based on shared signals]"
  e.g. "Ask [Name]: What is something you have always
        wanted to try but never had the chance to?"
  [Copy to chat — button]
```

Nudge card dismisses on tap anywhere outside it, or after 8 seconds.

---

### 3.6 Day 10+ — "I Feel Ready to Meet" Signal

**Sending party experience:**
- Taps [I feel ready to meet] on connection screen
- Brief confirmation prompt (not a modal — inline in the button area):
  ```
  "Send a readiness signal to [Name]?"
  [Send signal]  [Cancel]
  ```
- On confirm: button disappears entirely. No sent state shown. No waiting state. No reciprocal indicator.
- The signal is stored in matchmaker_ready_signals for rate-limiting only — one signal per user per connection
- Nothing appears on the connection screen for either party after the signal is sent
- The signal lives only as a push notification moment for the receiver
- Life goes on — conversation continues normally in chat.

**Receiving party experience (CANONICAL):**
- Push notification (if app closed):
  ```
  [Heart-ring icon]
  "[Name] feels ready to meet"
  "No pressure — your plan window opens in [X] days.
   Keep the conversation going."
  ```
- If app is open: warm toast notification at bottom of screen (same text, 4 seconds)
- Tapping notification → opens chat thread with that person
- No acknowledgement button anywhere. No required action. Awareness only.
- Nothing appears on the receiver's connection screen
- The entire signal lives only as this notification moment

---

### 3.7 Day 21 — Plan Window Unlocks

Push notification (both parties):
```
[Heart-ring icon — #9B1B4B]
"Your MatchMaker plan window is now open"
"When you are both ready — create a plan and take
 your connection into the real world."
```

Connection screen updates:
- Journey timeline: Day 21 milestone fills with checkmark, `#9B1B4B`
- [Create Plan] button becomes active — gradient fill `#6C63FF` to `#9B1B4B`
- Status bar updates: "Plan window is open"

**Create Plan interaction:**

Initiator (either party may initiate — no restriction):
```
Tap [Create Plan] on connection screen
→ MatchMaker plan proposal screen slides in:

[Warm full-screen — #FDF8F4]
[Ring-heart icon — 48pt — centred]
"Propose a meetup"
"Set the details. [Name] reviews and agrees before
 anything is confirmed or charged."

→ Initiator goes through standard LinkUp plan creation UI
→ Initiator selects preferred escrow pattern (A, B, or C)
→ On submit: other party receives push notification:
  "[Name] proposed a meetup plan. Review and agree."
→ Receiver: review screen shows plan details + escrow pattern
  Options: [Agree] or [Propose different split]
→ Standard LinkUp offer-and-agreement flow takes over
→ Escrow created ONLY after both parties agree
→ plans.matchmaker_connection_id set on plan creation
→ matchmaker_connections.first_plan_created_at set on first plan
```
Note: "No single proposing party" (Locked Decision #3) means EITHER party
may initiate — not that no one initiates. Both must consent before escrow locks.

---

### 3.8 Post-Meetup Flow

After the MatchMaker plan is confirmed completed via standard LinkUp meetup confirmation:

Both parties receive a private, separate prompt (in-app only — not push):

```
[Warm card — slides up as bottom sheet]

"How did you feel after meeting [Name]?"

[5-option selector — horizontal — icon + label]
  [↑↑] Much stronger
  [↑]  Stronger
  [→]  Same
  [↓]  Weaker
  [?]  Not sure yet

[Spacing: 24pt]

"What quality mattered most to you?"
[Short text input — placeholder: "Type something..."]

[CTA — "Save (private)" — muted styling — private label intentional]
[Link — "Skip for now"]
```

After this prompt (or skip), the main choice appears:

```
[Full screen — warm background]
[Ring-heart icon]
"What comes next for you and [Name]?"

[Two large cards — stacked]

  [Card 1 — primary border]
  "Continue this connection"
  "Keep building what you have started.
   You can create more plans without the 21-day wait."
  [Select]

  [Card 2 — muted border]
  "End this connection"
  "Close this chapter. A reflection period follows."
  [Select]
```

Behaviour:
- Prompt is shown once after plan completion. It is dismissible.
- If dismissed: connection remains active. Prompt does not reappear.
- No auto-end timeout. Connection persists until explicitly ended.
- No maximum connection duration. Multiple plans are supported indefinitely.
- Each card selection requires a confirmation tap — no accidental terminations.

---

## PART 4 — END CONNECTION FLOW

### 4.1 Initiating End Connection

From connection screen: tap "End this connection" (text link, bottom).

```
[Bottom sheet slides up — warm background]

"End your connection with [Name]?"

[Body — muted]
"This cannot be undone. [Name] will be notified
 that this connection has ended. No reason will
 be shared with them."

[Reason selection — required before proceeding]
  ○ Not compatible
  ○ Moving too slowly
  ○ Not feeling it
  ○ Personal reasons
  ○ Other

[Spacing: 24pt]

[CTA — "End connection" — #9B1B4B — only active when reason selected]
[Link — "Go back, keep this connection"]
```

On confirm:
- Medium haptic
- Bottom sheet closes
- MatchMaker tab transitions to the Reflection Period screen
- The other party receives push notification: "This connection has ended."

---

## PART 5 — REFLECTION & HEALING PERIOD

### 5.1 Reflection Period Screen (Days 1–3)

Replaces the pool and connection screen. Warm, calm visual state.

```
[Warm background — slightly desaturated from usual MatchMaker tone]

[Spacing: 60pt from top]

[Small ring-heart icon — 40pt — muted #9B1B4B at 50% opacity]

[Spacing: 24pt]

"Take a moment."
[22pt — bold — #1A1A2E — centred]

[Spacing: 12pt]

"Reflect on what you experienced.
 We will be here when you are ready."
[16pt — muted — centred]

[Spacing: 40pt]

[Optional reflection card — warm surface]
  "What did you learn from this connection?"
  [Multi-line text input]
  [Save privately — CTA — muted]
  [Skip — text link]

[Spacing: 40pt]

[Progress indicator]
  "Reflection period · Day [N] of 3"
  [Thin progress bar — muted — fills over 3 days]

[Muted note at bottom]
  "Your MatchMaker discovery pool resumes in
   [X] days. All other LinkUp features are
   available as normal."
```

The rest of the app is fully accessible. The MatchMaker tab shows only this screen for 3 days.

---

### 5.2 Healing Period Screen (Days 4–6)

Slightly warmer visual tone — signals forward movement.

```
[Header — same warm background but slightly more saturated]

"A moment to refine."
[22pt — bold]

[Spacing: 12pt]

"Before you return to MatchMaker, take a moment
 to update what matters to you."
[16pt — muted]

[Spacing: 32pt]

[5-question questionnaire — one question per page, paginated]

  Q1: "After this connection, how do you feel about
       the pace at which you communicated?"
      [Selection cards — 4 options]

  Q2: "Did your expectations around family goals
       change or become clearer?"
      [Selection cards — 4 options]

  Q3: "What quality mattered most to you in this
       connection?"
      [Short text input]

  Q4: "Was there anything you wish you had known
       about this person earlier?"
      [Short text input]

  Q5: "What do you want to feel differently in your
       next connection?"
      [Short text input]

  [Each question: "Next" CTA + "Skip this question" link]

[Final page after Q5]
  "Want to update any dealbreakers or values?"
  [Update dealbreakers — expandable panel]
  [Update values — expandable panel]
  [CTA — "Save and finish" → completes healing period]
  [Link — "Skip all, I will update later"]

[Progress indicator]
  "Healing period · Day [N] of 3"
```

---

### 5.3 Re-Entry Screen (Day 6+)

```
[Warm background — returning to full MatchMaker saturation level]

[Ring-heart icon — 48pt — #9B1B4B — centred — gentle pulse animation]

[Spacing: 24pt]

"Ready when you are."
[24pt — bold — centred]

[Spacing: 12pt]

"We have updated your MatchMaker profile based
 on what you shared. Your pool is waiting."
[16pt — muted — centred]

[Spacing: 40pt]

[CTA — "Enter MatchMaker" — primary gradient — full width]

[Spacing: 16pt]

[Text — muted — centred — 12pt]
"There is no rush. This will be here whenever you feel ready."
```

No expiry. No countdown. No pressure. Screen stays here indefinitely until the user taps.

---

## PART 6 — GUARDRAILS — INTERACTION STATES

### 6.1 Active Connection — MatchMaker Tab Entry

User taps MatchMaker tab while in an active connection.

```
MatchMaker tab opens directly to the connection screen.
No pool. No cards. No other profiles visible.

The tab root IS the connection screen.

If user taps MatchMaker tab icon again while already on
the connection screen: no navigation change, subtle pulse
on the ring-heart icon to confirm the tap was received.
```

---

### 6.2 Rapid Cycler — Cooldown Screen

```
[Warm background — muted tone — slightly cooler than usual]

[Clock icon — 48pt — #7B6E65 — centred]

[Spacing: 24pt]

"MatchMaker is paused for 30 days."
[22pt — bold]

[Spacing: 12pt]

"MatchMaker is built for intentional connections.
 We want to make sure the pool stays that way."

[Spacing: 32pt]

[Progress bar — shows days remaining of 30-day cooldown]
"[N] days remaining"

[Spacing: 24pt]

[Note card — warm surface]
"All other LinkUp features — Discover, Meetr,
 Messages, Saved — are fully available."

[Spacing: auto]

[CTA — disabled — greyed — "MatchMaker resumes in [N] days"]
```

After 30 days: CTA activates → tapping → re-entry screen (Part 5.3).

---

### 6.3 Subscription Lapse — Connection Paused State

```
[Warning banner — amber tone — top of connection screen]

"Your subscription has lapsed."
"Resolve your account to continue this connection.
 You have 14 days before it closes automatically."

[CTA in banner — "Restore subscription"]
```

If 14 days pass without resolution:
- Connection auto-ends via server
- Both parties receive notification: "This connection has ended."
- No reason given to either party
- Standard end connection / reflection period begins

---

## PART 7 — SETTINGS & PRIVATE HISTORY

### 7.1 MatchMaker Settings

Accessible via gear icon on MatchMaker pool screen or connection screen.

```
[Screen title: "MatchMaker Settings"]

[Section: My Values]
  Communication style    [Edit]
  Faith preference       [Edit]
  Family goals           [Edit]
  Pace preference        [Edit]

[Section: Dealbreakers]
  [Current dealbreakers listed]   [Edit]

[Section: Pool Visibility]
  Show me in MatchMaker pool      [Toggle — on/off]
  Toggling off: removes from pool silently.
  Toggling on: re-enters pool without gates
  (declaration already on record).

[Section: Account]
  Connection history              [View]
  Delete my MatchMaker profile    [Destructive — red text]
```

---

### 7.2 Private Connection History

```
[Screen title: "My Connection History"]
[Subtitle: "This is private and visible only to you."]

[List — most recent first]
  Each entry:
  [Photo thumbnail — 40pt circle]
  [Name]  [Duration — e.g. "14 days"]
  [Status — ended / plan created]
  [Date ended — muted]

[Empty state]
  "No previous connections yet."
```

No details beyond name, duration, and outcome. Reason for ending is never shown — not even to the user who selected it.

---

## SCREEN & INTERACTION SUMMARY

| Screen | Entry | Exit |
|---|---|---|
| Subscription gate | Tab tap (no Gold) | Upgrade or back |
| KYC gate | Tab tap (no KYC) | Verify or back |
| Intent Declaration | First entry | Confirm or back |
| Values setup | First entry | Complete or back |
| Pool — card stack | All gates passed | Swipe / tap actions |
| Profile view | Card tap | Back or express interest |
| Interests queue | Badge tap | Back |
| Re-affirmation | 60-day idle | Confirm or remove |
| Connection screen | Mutual interest | End or back |
| Chat thread | Open chat button | Back (Messages tab) |
| Shared Activity | Day 7+ button | Submit or close |
| Check-in nudge | Day 10 auto | Dismiss |
| Ready to meet | Day 10+ button | Confirm or cancel |
| Plan creation | Day 21+ button | Standard plan flow |
| Post-meetup prompt | Plan completion | Save or skip |
| End connection | Text link | Confirm (reason required) |
| Reflection screen | Connection ended | Auto (3 days) |
| Healing screen | Day 4 auto | Complete or skip |
| Re-entry screen | Day 6+ | Tap to enter |
| Cooldown screen | Rapid cycler trigger | Auto (30 days) |
| Settings | Gear icon | Back |
| Connection history | Settings | Back |

---

## PART 0 — ONBOARDING ADDITION

### 0.1 Communication Style Question — Placement

The question is added as a new sub-step within the existing interests/preferences step (Step 4 of 5 on both platforms). It appears immediately after the user selects their interest tags, before the Continue CTA of that step.

On web: inline card below the interest tag grid.
On mobile: new scroll section below interest tags within the same step screen.

No step counter change — it is part of Step 4, not a new Step 6. This keeps the onboarding length perception unchanged.

### 0.2 Communication Style — Screen Spec

**Label (shown above the options):**
"How do you prefer to communicate?"

**Sub-label (muted, below heading):**
"Helps us personalise your LinkUp experience"

**Options (single select, pill/card style):**
- "Daily contact, I like staying in touch regularly"
- "A few times a week, Regular but not every day"
- "Flexible, I go with the flow"

**Behaviour:**
- Selection optional — user can skip by tapping Continue without selecting
- If selected: stored as `communication_style` on profile
- If skipped: field remains null, MatchMaker Gate 4 will ask again
- Selected state: primary fill `#6C63FF` (web) / `#5E52FF` (mobile), white text
- Unselected state: surface white, border `#D8DCE6` (mobile) / `rgba(108,99,255,0.12)` (web)
- No MatchMaker mention anywhere on this screen

### 0.3 Gate 4 Pre-population Review Card

When user reaches MatchMaker Values Setup (Gate 4) and has a saved `communication_style`:

A review card appears at the very top of Step 1 (before the faith question):

```
[Review card — warm surface #FBF5F0 — border #EDE0D4 — rounded 12pt]

  "From your LinkUp profile"
  [12pt — muted — #7B6E65]

  "Communication style: [Their selection]"
  [14pt — bold — #1A1A2E]

  [Edit — text link — right — #6C63FF — 12pt]
  Tapping Edit → scrolls to communication style selector
  at bottom of this step where they can change it
```

If `communication_style` is null (was skipped in onboarding):
The review card is absent. A communication style selector appears inline in Step 1 of Gate 4 as a regular input.

---

## DATABASE NOTE — EXISTING TABLE MODIFICATION

```sql
-- Run alongside MatchMaker schema migration:
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS matchmaker_connection_id UUID NULL
  REFERENCES matchmaker_connections(id);
-- Links each MatchMaker plan to its connection row
-- Required for: plan history, first_plan_created_at logic,
--               subsequent plan 21-day lock bypass
```

---

## SCREEN PROTOTYPE

**Interactive prototype:** https://claude.ai/artifact/9TUDKmVvsa6KgbravWe2X7

The prototype is built with React, Plus Jakarta Sans (LinkUp mobile font), and the exact design tokens specified in this document. It covers all 10 screens listed below. Each screen is interactive — selection states, toggle states, and multi-phase flows (Shared Activity question → waiting → reveal) all work.

| Screen | Prototype Tab | Interactive States |
|---|---|---|
| Onboarding Step 4 | 0 · Onboarding | Interest tag selection, communication style single-select |
| Subscription Gate | 1A · Gold Gate | Static — benefits list |
| Intent Declaration | 1B · Declaration | Checkbox ticks, CTA activates |
| Values Setup | 1C · Values Setup | 4-step progress, all selection cards, dealbreaker toggles |
| Pool — Card Stack | 2 · Pool | Express Interest button with overlay |
| Connection Screen | 3 · Connection | Journey timeline, locked/unlocked button states |
| Shared Activity | 3D · Shared Activity | Question → waiting → reveal (3 phases) |
| End Connection | 4 · End Connection | Reason selection, End button activates on select |
| Reflection Period | 5A · Reflection | Text input, progress bar |
| Re-Entry Screen | 5C · Re-Entry | CTA button |

**Technology:** React 18 + Babel standalone. Fonts: Plus Jakarta Sans (same as mobile). No external CSS frameworks. All design tokens inline. Ready for Cursor binding — component structure maps directly to mobile React Native and web Next.js/Tailwind implementations.
