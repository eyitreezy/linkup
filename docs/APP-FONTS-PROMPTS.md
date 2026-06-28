# LinkUp — Font change prompts

Copy a block below into Cursor to change typography. Pair with [`APP-FONTS.md`](./APP-FONTS.md) for role names and file locations.

**Current state:** UI uses **Plus Jakarta Sans** (`@expo-google-fonts/plus-jakarta-sans`), loaded in `app/_layout.tsx`. Tokens in `constants/theme.ts`; roles in `constants/typography.ts`.

---

## Global UI font swap

Replace `System` with a custom family everywhere (e.g. Inter).

```
Change the LinkUp mobile app UI font from System to Inter.

1. Install and load Inter via @expo-google-fonts/inter in app/_layout.tsx (useFonts, block render until loaded).
2. Update constants/theme.ts:
   - fonts.regular → Inter_400Regular
   - fonts.medium → Inter_600SemiBold
   - fonts.bold → Inter_800ExtraBold
3. Create constants/typography.ts with roles from docs/APP-FONTS.md (display, headline, title, body, caption) each setting fontFamily from fonts.*.
4. Wire fonts into P0 shared components first: Button.tsx, Input.tsx, LinkUpTabBar.tsx, PlanStackScreenHeader.tsx, AuthHeroCopy.tsx, AppSplashScreen.tsx, kycTheme.ts.
5. Add fontFamily: fonts.regular to resolveBubbleTheme in lib/messaging/chatAppearance.ts.
6. Sweep remaining StyleSheets under app/ and components/ — add fontFamily via typography tokens where text styles exist.
7. Do NOT change admin monospace styles unless I ask.

Follow docs/APP-FONTS.md for role sizes and weights. Keep existing fontSize and fontWeight values; only add fontFamily.
```

---

## Single-family swap (minimal)

Only update the token file + font loading; no typography.ts yet.

```
Load Inter from @expo-google-fonts/inter in app/_layout.tsx and set constants/theme.ts fonts.regular/medium/bold to the correct Inter_* postscript names. Do not change any component files yet.
```

---

## Display & headline only

Keep body on System; change hero/splash/auth/KYC large type.

```
Change only display and headline typography to Poppins:

- Load Poppins_700Bold and Poppins_800ExtraBold in app/_layout.tsx.
- Add fonts.display = 'Poppins_800ExtraBold' to constants/theme.ts.
- Apply fonts.display only in:
  - components/splash/AppSplashScreen.tsx (wordmark, taglines)
  - components/auth/AuthHeroCopy.tsx (headline)
  - components/kyc/kycTheme.ts (leadTitle, leadKicker, sectionTitle)
  - components/navigation/PlanStackScreenHeader.tsx (heroTitle, kicker)
  - components/ui/AppConfirmModal.tsx and PremiumFeaturePaywallModal.tsx titles

Leave Button, Input, body copy, and tab bar on System (or fonts.regular).
```

---

## Body & inputs only

```
Switch body text and form inputs to Inter Regular without changing headline weights:

- Load Inter_400Regular and Inter_600SemiBold.
- Set fonts.regular and fonts.medium in constants/theme.ts.
- Update components/Input.tsx (all TextInput and label styles).
- Update components/Button.tsx text styles to use fonts.medium.
- Update components/messages/ChatBubble.tsx and MessageInput.tsx via chatAppearance resolveBubbleTheme.

Do not change splash wordmark or PlanStackScreenHeader heroTitle.
```

---

## Tab bar & navigation

```
Change bottom tab labels and stack headers to use fonts.medium from constants/theme.ts:

- LinkUpTabBar.tsx label style
- PlanStackScreenHeader.tsx heroTitle, title, kicker

Load the font family in _layout if not already loaded. Keep fontSize and fontWeight unchanged.
```

---

## Auth & splash rebrand

```
Rebrand auth and splash typography to match a premium dating app using DM Sans:

- Load DM Sans weights 500, 700, 800 in app/_layout.tsx.
- components/splash/AppSplashScreen.tsx — wordmark uses fonts.bold (800), taglines use fonts.regular/medium.
- components/auth/AuthHeroCopy.tsx — headline fonts.bold, subtext fonts.regular at weight 500.
- components/auth/AuthScreen.tsx — card title and links use fonts.medium.

Reference docs/APP-FONTS.md Auth & onboarding section for exact font sizes.
```

---

## KYC flow only

```
Apply fonts.bold and fonts.regular from constants/theme.ts to all text styles in components/kyc/kycTheme.ts (kycInboxStyles and kycStyles). Ensure KycSelectionCard, KycNoticeModal, and kyc steps inherit the same families. Do not modify non-KYC screens.
```

---

## Plan cards & discover feed

```
Update discover and plan card typography to use fonts.bold for titles and fonts.regular for meta:

- components/plans/PlanCard.tsx
- components/discovery/DiscoverySwipeCard.tsx
- components/discovery/PlanEngagementStrip.tsx
- components/meetr/MeetTypeExploreCard.tsx

Keep fontSize and fontWeight; add fontFamily from constants/theme.ts.
```

---

## Subscription & premium

```
Wire custom font into subscription and premium UI:

- app/subscription.tsx
- components/subscription/SubscriptionTierCard.tsx, MembershipHero.tsx, BillingCycleToggle.tsx
- components/profile/PremiumCard.tsx, PremiumBadge.tsx
- components/premium/PremiumFeaturePaywallModal.tsx

Use fonts.bold for tier names and prices, fonts.regular for feature lists.
```

---

## Chat bubbles

```
Add fontFamily to chat messages without changing user font size/emphasis settings:

- In lib/messaging/chatAppearance.ts resolveBubbleTheme, set fontFamily from fonts.regular (or fonts.medium when fontEmphasis is bold).
- Apply the same in MessageInput.tsx composer field.

Do not remove fontScale (s/m/l) or fontEmphasis (normal/bold) picker in ChatAppearanceSheet.
```

---

## Monospace

```
Change admin/debug monospace to JetBrains Mono:

- Add fonts.mono to constants/theme.ts.
- Update only: AdminUsersPanel.tsx, AdminPlansPanel.tsx, AdminSupportTicketModal.tsx, app/settings/delete-account.tsx.
- Use Platform.select for iOS/Android postscript names after loading the font.

Do not apply mono font to general UI text.
```

---

## Revert to system fonts

```
Remove custom font loading from app/_layout.tsx. Set constants/theme.ts fonts.regular/medium/bold back to 'System'. Remove fontFamily overrides from components that were added for custom fonts (or set fontFamily: undefined). Keep fontSize and fontWeight as-is.
```

---

## Full rebrand (fonts + reference doc)

```
Rebrand all LinkUp mobile typography to [FONT NAME]. Follow docs/APP-FONTS.md migration path (P0 → P3). Update docs/APP-FONTS.md family table to reflect the new postscript names. Create constants/typography.ts. Test on iOS and Android.
```

---

## Quick reference — role → prompt token

| Say this in a prompt | Means |
|----------------------|-------|
| `typography.display` | 46–28px, weight 900, splash/auth/KYC hero |
| `typography.headline` | 20–24px, weight 800–900, modals & screen titles |
| `typography.title` | 16–19px, weight 700–800, cards & sections |
| `typography.body` | 14–16px, weight 400–600, inputs & paragraphs |
| `typography.caption` | 10–13px, weight 600–900, tabs, badges, time |
| `typography.mono` | 11px monospace, admin IDs only |
| `fonts.regular` | Token in `constants/theme.ts` — body family |
| `fonts.medium` | Token — semibold UI family |
| `fonts.bold` | Token — headline family |
