# LinkUp — App color palette

Design tokens are defined in `constants/theme.ts` and `constants/gradients.ts`. This document lists the primary colors and gradient presets used across mobile and web.

---

## Brand core

| Token | Hex | Usage |
|-------|-----|--------|
| **Primary** | `#6C63FF` | CTAs, active tabs, links, selection states, brand accent |
| **Secondary** | `#FF6584` | Accent highlights, notification dot, warm contrast to primary |

These two colors anchor most gradients and interactive UI.

---

## Neutrals & surfaces

| Token | Hex | Usage |
|-------|-----|--------|
| **Background** | `#F5F6FA` | Default screen background |
| **Surface** | `#FFFFFF` | Cards, tab bar, modals, inputs on tinted shells |
| **Text** | `#1A1D26` | Primary body and headings |
| **Text muted** | `#6B7280` | Secondary copy, hints, inactive tab labels |
| **Border** | `#E5E7EB` | Dividers, input borders |

### Auth-specific surfaces

| Token | Hex | Usage |
|-------|-----|--------|
| **Auth card** | `#FFFFFF` | Login / signup card fill |
| **Auth input bg** | `#F8F9FC` | Soft input fields on auth screens |

---

## Semantic colors

| Token | Hex | Usage |
|-------|-----|--------|
| **Success** | `#10B981` | Confirmations, completed states |
| **Warning** | `#F59E0B` | Alerts, urgency banners, goodwill accents |
| **Danger** | `#EF4444` | Errors, destructive actions |
| **Pass action** | `#FF5A5F` | Swipe-pass / dismiss controls (Tinder-style) |

---

## Overlays

| Token | Value | Usage |
|-------|-------|--------|
| **Overlay dark** | `rgba(26, 29, 38, 0.55)` | Modal backdrops |

---

## Named gradient presets (`constants/gradients.ts`)

### CTA gradient — primary buttons

| Stop | Hex |
|------|-----|
| Start | `#6C63FF` |
| End | `#FF6584` |

**Token:** `APP_CTA_GRADIENT`  
**Direction:** top-left → bottom-right (typical)  
**Used for:** Publish, Continue, Apply, membership hero, trial welcome modals

```css
background: linear-gradient(135deg, #6C63FF 0%, #FF6584 100%);
```

### Chip / selection gradient — pills & tags

| Stop | Hex |
|------|-----|
| Start | `#6C63FF` |
| Mid | `#8B7CE8` |
| End | `#FF6584` |

**Token:** `APP_CHIP_GRADIENT`  
**Used for:** Selected filter chips, interest pills, progress bars, profile accents, onboarding selection

```css
background: linear-gradient(135deg, #6C63FF 0%, #8B7CE8 50%, #FF6584 100%);
```

---

## Screen shell gradients

### Auth (login / signup)

| Stop | Hex | Token |
|------|-----|-------|
| Top | `#2D1B4E` | `authGradientTop` |
| Mid | `#6C63FF` | `authGradientMid` |
| Bottom | `#FF6584` | `authGradientBottom` |

Deep purple → brand primary → coral pink. Full-screen vertical gradient.

### Discovery feed

| Stop | Hex | Token |
|------|-----|-------|
| Top | `#F5F6FA` | `discoveryGradientTop` |
| Mid | `#EDE8FF` | `discoveryGradientMid` |
| Bottom | `#FFF5F8` | `discoveryGradientBottom` |

Soft lavender → blush. Used on Discover, subscription, and related flows.

### App shell (tabs, settings, wallet, plan create)

Four-stop diagonal gradient used on most tab screens:

| Stop | Hex |
|------|-----|
| 1 | `#EDE8FF` |
| 2 | `#FFF0F5` |
| 3 | `#E8FAF4` |
| 4 | `#F5F6FA` (`discoveryGradientBottom` / `background`) |

**Component:** `DiscoveryGradientBg`, `SettingsStickyShell`  
**Locations:** `[0, 0.28, 0.55, 1]` typical

### Onboarding wizard

| Stop | Hex |
|------|-----|
| 1 | `#EDE8FF` |
| 2 | `#FFF0F5` |
| 3 | `#E8FAF4` |
| 4 | `#F5F6FA` |

Same family as app shell; cards use `rgba(255,255,255,0.96)` on top.

### Plan create (step 1)

| Stop | Hex |
|------|-----|
| 1 | `#EDE8FF` |
| 2 | `#FFF5F8` |
| 3 | `#E8FAF4` |
| 4 | `#F5F6FA` |

---

## Common accent stops (not in `theme.ts`)

These appear frequently as mid-points in gradients:

| Hex | Role |
|-----|------|
| `#8B7CE8` | Primary-light mid-stop (chips, headers, support) |
| `#8B7CFF` | Primary-light variant (offers segment, messages empty) |
| `#A78BFA` | Meet type “Dinner” gradient end |
| `#F3EFFF` | Soft lavender panel fill (support modals) |

---

## Subscription tier gradients (`TierBadge`)

| Tier | Start | End | Border (optional) |
|------|-------|-----|-------------------|
| **Silver** | `#C0C5CE` | `#9CA3AF` | — |
| **Gold** | `#F5D76E` | `#D4A017` | — |
| **Platinum** | `#E8EAF6` | `#7C4DFF` | `#5E35B1` |

---

## Meetr / meet-type card gradients (`lib/plans/meetTypeVisuals.ts`)

| Meet type slug | Start | End |
|----------------|-------|-----|
| **mood** | `#FF6584` | `#FF9A76` |
| **dinner** | `#6C63FF` | `#A78BFA` |
| **casual** | `#34D399` | `#6EE7B7` |
| **gym** | `#F59E0B` | `#FBBF24` |
| **hangout** | `#3B82F6` | `#60A5FA` |
| **group** | `#8B5CF6` | `#C084FC` |
| **Default** (custom types) | `#6C63FF` | `#FF6584` |

---

## Soft tints & glass (RGBA)

Common translucent overlays derived from primary:

| Value | Usage |
|-------|--------|
| `rgba(108, 99, 255, 0.06)` | Dashed add-chip background |
| `rgba(108, 99, 255, 0.08)` | KYC / info banner backgrounds |
| `rgba(108, 99, 255, 0.10)` | Discovery urgency / filter pills |
| `rgba(108, 99, 255, 0.12)` | Onboarding accent soft, card borders |
| `rgba(108, 99, 255, 0.18)` | Glass borders, nav pills |
| `rgba(108, 99, 255, 0.22)` | Plans KYC banner border |
| `rgba(108, 99, 255, 0.28)` | Active filter pill border |

| Value | Usage |
|-------|--------|
| `rgba(255, 101, 132, 0.08)` | Error / trial tip card tint |
| `rgba(255, 101, 132, 0.25)` | Error box border |
| `rgba(245, 158, 11, 0.12)` | Amber education callouts |
| `rgba(16, 185, 129, 0.12)` | Success / goodwill pill background |

---

## Shadow colors

| Hex | Usage |
|-----|--------|
| `#1A1D26` | Default card / tab bar shadow |
| `#2a1f55` | Elevated cards (plan cards, meetr grid) |
| `#6C63FF` | Primary-tinted CTA glow (iOS) |

---

## Quick reference — CSS custom properties

For web or design handoff:

```css
:root {
  --linkup-primary: #6C63FF;
  --linkup-secondary: #FF6584;
  --linkup-primary-light: #8B7CE8;
  --linkup-background: #F5F6FA;
  --linkup-surface: #FFFFFF;
  --linkup-text: #1A1D26;
  --linkup-text-muted: #6B7280;
  --linkup-border: #E5E7EB;
  --linkup-success: #10B981;
  --linkup-warning: #F59E0B;
  --linkup-danger: #EF4444;

  --linkup-gradient-cta: linear-gradient(135deg, #6C63FF 0%, #FF6584 100%);
  --linkup-gradient-chip: linear-gradient(135deg, #6C63FF 0%, #8B7CE8 50%, #FF6584 100%);
  --linkup-gradient-shell: linear-gradient(135deg, #EDE8FF 0%, #FFF0F5 35%, #E8FAF4 65%, #F5F6FA 100%);
  --linkup-gradient-auth: linear-gradient(180deg, #2D1B4E 0%, #6C63FF 50%, #FF6584 100%);
}
```

---

## Source files

| File | Contents |
|------|----------|
| `constants/theme.ts` | Core palette, discovery/auth tokens, spacing, radius |
| `constants/gradients.ts` | `APP_CTA_GRADIENT`, `APP_CHIP_GRADIENT` |
| `components/onboarding/onboardingTheme.ts` | Onboarding glass / accent tokens |
| `components/kyc/kycTheme.ts` | KYC screen tokens (mirrors primary palette) |
| `lib/plans/meetTypeVisuals.ts` | Meetr category card gradients |
| `components/TierBadge.tsx` | Subscription tier gradients |
