# LinkUp — App typography & font families

Typography tokens live in `constants/theme.ts` (`fonts` object). **Today the app does not load custom font files** — almost all UI text uses React Native’s default **`System`** family with `fontWeight` and `fontSize` for hierarchy.

Use this document with [`APP-FONTS-PROMPTS.md`](./APP-FONTS-PROMPTS.md) when you want to swap fonts via a short Cursor prompt.

---

## Font families in use

| Family ID | `fontFamily` value | Platform rendering | Role | Loaded? |
|-----------|-------------------|-------------------|------|---------|
| **UI default** | `PlusJakartaSans_*` via `fonts.regular` / `medium` / `bold` | iOS & Android — loaded in `app/_layout.tsx` | All screens & components | `@expo-google-fonts/plus-jakarta-sans` |
| **Monospace** | `'monospace'` (Android) / `'Menlo'` (iOS) | System mono | Admin IDs, debug strings | Built-in |
| **Icons** | `Ionicons` via `@expo/vector-icons` | Vector icon font | Tab bar, buttons, chips — **not body text** | Bundled |

> **Note:** `expo-font` is installed but **no `useFonts` / `Font.loadAsync` calls exist** and there is no `assets/fonts/` folder yet. Switching to Inter, Poppins, etc. requires loading files first (see [How to change fonts globally](#how-to-change-fonts-globally)).

---

## Central token file

```56:61:constants/theme.ts
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_800ExtraBold',
} as const;
```

| Token | PostScript name | Typical `fontWeight` | Status |
|-------|-----------------|---------------------|--------|
| `fonts.regular` | `PlusJakartaSans_400Regular` | `400`–`500` | **Wired** app-wide |
| `fonts.medium` | `PlusJakartaSans_600SemiBold` | `600`–`700` | **Wired** app-wide |
| `fonts.bold` | `PlusJakartaSans_800ExtraBold` | `800`–`900` | **Wired** app-wide |

---

## Typography roles (weight + size system)

Because `fontFamily` is rarely set, hierarchy is achieved with **`fontWeight`** and **`fontSize`**. Use these role names in prompts.

| Role | Token name (prompt) | Weight | Size (px) | Letter-spacing | Where it appears |
|------|---------------------|--------|-----------|----------------|------------------|
| **Display** | `typography.display` | `900` | 46, 28, 26 | −0.6 to −1.2 | Splash wordmark, auth hero headline, KYC lead titles, large empty states |
| **Headline** | `typography.headline` | `800`–`900` | 20–24 | −0.3 to −0.55 | Modal titles, plan detail hero, subscription hero, dispute/support titles |
| **Title** | `typography.title` | `700`–`800` | 16–19 | −0.2 to −0.4 | Card titles, section headers, stack nav titles, CTA button labels (auth full-width) |
| **Body** | `typography.body` | `400`–`600` | 14–16 | −0.2 to 0 | Input text, chat bubbles (default), list descriptions, form helpers |
| **Caption** | `typography.caption` | `600`–`900` | 10–13 | 0 to 1.0 | Tab labels, badges, kickers (uppercase), timestamps, tier pills |
| **Mono** | `typography.mono` | `400` | 11 | 0 | Admin user IDs, plan IDs, delete-account confirmation |

### Weight usage across the codebase (approx.)

| `fontWeight` | ~Occurrences | Visual role |
|--------------|--------------|-------------|
| `900` | 200+ | Display, kickers, prices, premium badges |
| `800` | 150+ | Headlines, CTAs, nav titles |
| `700` | 80+ | Titles, labels, button text (auth) |
| `600` | 120+ | Body emphasis, meta, chips |
| `500` | 15 | Auth subcopy, light secondary |
| `400` | 2 | Chat “normal” emphasis only |

### Common `fontSize` values

| Size | Typical role |
|------|----------------|
| 46 | Splash wordmark |
| 28 | Auth hero, profile preview name |
| 26 | KYC lead title |
| 22–24 | Screen titles, plan card title (swipe) |
| 17–19 | Auth card title, modal title, header (stack) |
| 15–16 | Body, inputs, buttons (default) |
| 13–14 | Secondary body, errors, list meta |
| 11–12 | Captions, badges, admin mono |
| 10 | Tab bar labels |

---

## Shared components (change these first for global impact)

These files define typography reused across many screens. **Prioritize them** when swapping fonts.

| File | Styles | Role mapping |
|------|--------|--------------|
| `components/Button.tsx` | `text` (16 / `600`), `textAuth` (16 / `700`) | All primary/secondary/ghost CTAs |
| `components/Input.tsx` | `label`, `labelSoft`, `authTextInput`, `authPasswordInput`, `err`, `errAuth` | All form fields (auth, onboarding, plans) |
| `components/navigation/LinkUpTabBar.tsx` | `label` (10 / `600`) | Bottom tab labels |
| `components/navigation/PlanStackScreenHeader.tsx` | `heroTitle` (22 / `900`), `title` (17 / `800`), `kicker` (11 / `900`) | Plan stack screens |
| `components/auth/AuthHeroCopy.tsx` | `headline` (28 / `800`), `subtext` (15 / `500`) | Login/signup hero |
| `components/auth/AuthScreen.tsx` | Card title, links, verification copy | Auth glass card |
| `components/splash/AppSplashScreen.tsx` | `wordmark` (46 / `900`), `tagline` (18 / `700`), `taglineSecondary` (16 / `500`) | Cold start splash |
| `components/kyc/kycTheme.ts` | `kycInboxStyles.*`, `kycStyles.*` | Entire KYC flow (lead blocks, section heads, bullets) |
| `lib/messaging/chatAppearance.ts` | `fontSizeFromScale`, `fontWeightFromEmphasis` | Chat bubble text (user preference) |

---

## Where typography is applied (by app area)

### Auth & onboarding

| Screen / component | Headline styles | Body styles |
|--------------------|-----------------|-------------|
| `components/splash/AppSplashScreen.tsx` | 46 / `900` wordmark | 16–18 / `500`–`700` taglines |
| `components/auth/AuthHeroCopy.tsx` | 28 / `800` | 15 / `500` |
| `components/auth/AuthScreen.tsx` | 19 / `800` card title | 13 / `600`–`700` links |
| `components/Input.tsx` (auth variant) | — | 16 inputs; 13 errors |
| `app/onboarding/index.tsx` | 22–26 / `800`–`900` section titles | 14–16 / `600` fields |
| `components/onboarding/ProfileCardPreview.tsx` | 28 / `800` name | 13–17 body |

### Main tabs

| Tab | Key files | Dominant weights |
|-----|-----------|------------------|
| **Discover** | `app/(tabs)/index.tsx`, `components/discovery/*`, `components/plans/PlanCard.tsx` | `800`–`900` titles; `600` meta |
| **Meetr** | `app/(tabs)/meetr.tsx`, `components/meetr/MeetTypeExploreCard.tsx` | 15 / `800` tile titles |
| **Messages** | `app/(tabs)/messages.tsx`, `components/messages/*` | 16 / `800` names; 10–14 captions |
| **Offers** | `app/(tabs)/offers.tsx`, `components/offers/*` | `800`–`900` headers |
| **Profile** | `app/(tabs)/profile.tsx`, `components/profile/*` | `800`–`900` hero; `600` rows |
| **Saved** | `app/(tabs)/saved.tsx` | Same as discover list |

### Plans & discovery cards

| Component | Notable typography |
|-----------|-------------------|
| `components/plans/PlanCard.tsx` | Swipe: 22+ / `800`–`900`; list: 17 / `800` title; 13–14 / `600` meta |
| `components/discovery/DiscoverySwipeCard.tsx` | Large overlay type, `800`–`900` |
| `components/plans/PlanInterestedStrip.tsx` | 13–15 / `600`–`800` |
| `components/plans/PlansFilterSheet.tsx` | 12–20 mixed weights |

### Plan detail & create flows

| Area | Files |
|------|-------|
| Detail | `app/plan/[id]/index.tsx`, `app/plan/[id]/interest.tsx`, `app/plan/[id]/agreement.tsx` |
| Create | `app/plan/create/*.tsx`, `components/plans/create/*` |
| Headers | `components/navigation/PlanStackScreenHeader.tsx` |

### Messaging & chat

| File | Behavior |
|------|----------|
| `components/messages/ChatBubble.tsx` | Uses `resolveBubbleTheme()` — **size 15/16/18**, weight **`400` or `700`** |
| `components/messages/MessageInput.tsx` | 16px composer |
| `components/messages/ChatAppearanceSheet.tsx` | User picks scale + emphasis (not family) |
| `lib/messaging/chatAppearance.ts` | `fontSizeFromScale`, `fontWeightFromEmphasis` |

### Subscription & wallet

| File | Typography |
|------|------------|
| `app/subscription.tsx` | `900` tier names; `800` CTAs |
| `components/subscription/SubscriptionTierCard.tsx` | `800`–`900` pricing |
| `components/subscription/MembershipHero.tsx` | Display-scale hero |
| `components/profile/PremiumCard.tsx` | 20 / `900` title |
| `app/wallet.tsx` | `800`–`900` balances |

### KYC & verification

| File | Notes |
|------|-------|
| `components/kyc/kycTheme.ts` | **Central KYC typography** — lead 26/900, section 12/900 uppercase |
| `components/kyc/KycSelectionCard.tsx` | 17 / `800` |
| `app/kyc/index.tsx`, `components/kyc/steps/*` | Inherits kycTheme patterns |

### Settings & support

| File | Notes |
|------|-------|
| `app/settings/*.tsx` | 17–22 / `800` headers; 14–15 / `600` body |
| `components/profile/ProfileSettingsRow.tsx` | 16 / `600`–`700` |
| `app/support.tsx`, `app/support/ticket/[id].tsx` | Dense `800`–`900` headers |

### Admin (internal)

| File | Special font |
|------|--------------|
| `components/admin/AdminUsersPanel.tsx` | `fontFamily: 'monospace'` on IDs |
| `components/admin/AdminPlansPanel.tsx` | `fontFamily: 'monospace'` |
| `components/admin/AdminSupportTicketModal.tsx` | `Menlo` / `monospace` |
| `app/admin/index.tsx` | Standard UI weights + mono snippets |

### Modals & system UI

| Component | Title pattern |
|-----------|---------------|
| `components/ui/AppConfirmModal.tsx` | 20 / `900` |
| `components/ui/AppDetailModal.tsx` | 18–20 / `800` |
| `components/ui/AppFeedbackModal.tsx` | 20 / `800` |
| `components/checkout/FlutterwaveCheckoutModal.tsx` | 17–20 / `700`–`800` |
| `components/premium/PremiumFeaturePaywallModal.tsx` | 22 / `900` |

---

## Monospace (separate from UI default)

Only used for **machine-readable strings** (IDs, tokens). Do not swap to a brand font.

| File | Style key | `fontFamily` |
|------|-----------|--------------|
| `components/admin/AdminUsersPanel.tsx` | `monoSmall` | `'monospace'` |
| `components/admin/AdminPlansPanel.tsx` | `mono` | `'monospace'` |
| `components/admin/AdminSupportTicketModal.tsx` | debug block | `Platform.select({ ios: 'Menlo', android: 'monospace' })` |
| `app/settings/delete-account.tsx` | confirmation token | `Platform.select({ ios: 'Menlo', android: 'monospace' })` |

**Prompt to change mono only:** see [`APP-FONTS-PROMPTS.md` — Monospace](./APP-FONTS-PROMPTS.md#monospace).

---

## Icon font (not text)

| Package | Usage |
|---------|-------|
| `@expo/vector-icons` → **Ionicons** | Tab icons, chevrons, plan meta icons, auth eye toggle, splash logo glyph |

Icons are **not** controlled by `constants/theme.ts`. Changing the icon set is a separate task (replace `Ionicons` imports or switch to Material Symbols).

---

## Chat appearance (user-controlled scale)

Chat is the only area with **runtime typography settings** (still System family):

| Setting | Values | Effect |
|---------|--------|--------|
| `fontScale` | `s` / `m` / `l` | 15 / 16 / 18 px |
| `fontEmphasis` | `normal` / `bold` | `400` / `700` |

Source: `lib/messaging/chatAppearance.ts` → consumed by `components/messages/ChatBubble.tsx`.

---

## How to change fonts globally

### Recommended migration path

1. **Pick families** — e.g. Inter (UI), Menlo (mono, unchanged).
2. **Load fonts** — add `@expo-google-fonts/inter` or `assets/fonts/*.ttf` + `useFonts` in `app/_layout.tsx`.
3. **Update tokens** in `constants/theme.ts`:

```ts
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_600SemiBold',
  bold: 'Inter_800ExtraBold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;
```

4. **Add** `constants/typography.ts` with role presets that spread `fontFamily: fonts.*` + size/weight (optional but makes prompts trivial).
5. **Wire shared components first** (table above), then sweep screen-local `StyleSheet`s.
6. **Keep** chat `fontSizeFromScale` / `fontWeightFromEmphasis`; add `fontFamily: fonts.regular` in `resolveBubbleTheme`.

### Files to touch for a full rebrand

| Priority | Paths |
|----------|-------|
| P0 | `constants/theme.ts`, `app/_layout.tsx` (font loading) |
| P1 | `components/Button.tsx`, `components/Input.tsx`, `components/navigation/*`, `components/kyc/kycTheme.ts` |
| P2 | `components/auth/*`, `components/splash/AppSplashScreen.tsx`, `components/ui/*Modal.tsx` |
| P3 | `app/(tabs)/*`, `app/plan/**`, `app/settings/**`, remaining `components/**` |
| Skip | Admin `monospace` unless explicitly requested |

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [`APP-FONTS-PROMPTS.md`](./APP-FONTS-PROMPTS.md) | Copy-paste prompts for Cursor |
| [`APP-COLORS.md`](./APP-COLORS.md) | Color tokens (pair with fonts for full rebrand) |

---

## Source files summary

| File | Contents |
|------|----------|
| `constants/theme.ts` | `fonts.regular` / `medium` / `bold` (Plus Jakarta Sans) |
| `constants/typography.ts` | Role presets + `fontFamilyForWeight()` helper |
| `app/_layout.tsx` | `useFonts` — loads Plus Jakarta Sans before app render |
| `components/kyc/kycTheme.ts` | KYC shared text styles |
| `lib/messaging/chatAppearance.ts` | Chat font scale & emphasis |
| `components/Button.tsx` | Global CTA typography |
| `components/Input.tsx` | Global form typography |
| `components/navigation/LinkUpTabBar.tsx` | Tab label typography |
| `components/navigation/PlanStackScreenHeader.tsx` | Stack header typography |
