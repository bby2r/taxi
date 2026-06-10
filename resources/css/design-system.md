# Alif Taxi — Design System

Brand palette, type scale, spacing and component patterns shared between
the mobile apps (`mobile/packages/shared/src/theme/colors.ts`) and this
website. Source of truth lives here; web tokens are registered in
`app.css` under `@theme`, mobile tokens in `ClientColors` / `DriverColors`.

## Brand position

Local taxi for Talas region, Kyrgyzstan. Editorial-travel-magazine
aesthetic — refined serif headlines, warm cream canvas, deep ink body
text, brand aqua-teal as the lead color, coral as warm energy accent.
Distinctive *because* it avoids the corporate-taxi defaults (Yandex
yellow / Bolt green / Uber black) and the AI-startup defaults (purple
gradient blobs, generic Inter typography).

## Color tokens

All values are sRGB hex. Semantic role first, raw value second. Mobile
parity in the rightmost column — keep these aligned when one moves.

### Canvas + ink (page surfaces and type)

| Token              | Hex       | Role                                  | Mobile parity        |
|--------------------|-----------|---------------------------------------|----------------------|
| `canvas`           | `#F4FBFA` | Page background. Mint-tinted whisper white — warmer than `#FFFFFF`, prevents the "sterile lab" feel. | `ClientColors.background` |
| `canvas-deep`      | `#E8F6F4` | Card resting state, chip/pill backgrounds. | `ClientColors.surfaceMuted` |
| `ink`              | `#0F2937` | Body text, primary surfaces, dark CTA fills. Cool dark with slight teal tinge keeps cohesion with `primary`. | `ClientColors.dark` / `textPrimary` |
| `ink-soft`         | `#334155` | Secondary text, lead paragraphs.       | `ClientColors.darkSecondary` |
| `ink-mute`         | `#6B7A8F` | Captions, micro-labels, footer text.   | `ClientColors.textMuted` |
| `rule`             | `#D9F0EC` | Dividers, card borders.                | `ClientColors.border` |

### Brand color (primary aqua-teal)

| Token              | Hex       | Role                                  | Mobile parity        |
|--------------------|-----------|---------------------------------------|----------------------|
| `primary`          | `#14B8A6` | Brand mark, CTA fills, active states, link hover. | `ClientColors.primary` |
| `primary-deep`     | `#0F8F80` | CTA hover, serif-italic emphasis, prices. | `ClientColors.primaryDark` |
| `primary-tint`     | `#CCFBF1` | Tinted surfaces, success badges, hover backgrounds. | `ClientColors.primaryTint` |

### Coral (secondary / energy accent)

| Token              | Hex       | Role                                  | Mobile parity        |
|--------------------|-----------|---------------------------------------|----------------------|
| `coral`            | `#FF7B1A` | Stat numerals, driver-section accent, warm punctuation. | `ClientColors.secondary` |
| `coral-deep`       | `#E0610A` | Coral on hover, eyebrow text over canvas-deep. | `ClientColors.secondaryDark` |
| `coral-tint`       | `#FFE7D2` | Soft coral surfaces (rare).            | `ClientColors.secondaryTint` |

### Violet (small-area accent)

Used sparingly — special-tier badges and one-off pictograms only. The
brand violet is what ties web/mobile back to the original Alif "A"
glyph, so it stays present as a memory cue without competing with the
teal lead.

| Token              | Hex       | Role                                  | Mobile parity        |
|--------------------|-----------|---------------------------------------|----------------------|
| `violet`           | `#6C2BD9` | Premium / "pro" badge fills, special pills. | `ClientColors.accent` |
| `violet-tint`      | `#EDE3FF` | Violet-tinted backgrounds.             | `ClientColors.accentTint` |

### State

| Token     | Hex       | Role                  |
|-----------|-----------|-----------------------|
| `success` | `#10B981` | Confirmation states.  |
| `danger`  | `#EF4444` | Errors, destructive.  |

## Typography

Two distinctive variable fonts. Body is warm geometric sans; display is
expressive serif with optical-size + SOFT axes that give us italics
without going Times-New-Roman generic.

```
Display (h1, h2, h3, brand mark, stat numerals)
  Fraunces — variable axes: opsz 9..144, SOFT 0..100
  Weights used: 500 (display), 600 (h3), 700 (driver-card-stat fill)
  font-variation-settings: 'opsz' 144, 'SOFT' 30   /* default body display */
  font-variation-settings: 'opsz' 144, 'SOFT' 100  /* italics — softer round forms */

Body (paragraphs, lists, buttons, UI chrome)
  Manrope — variable weight 400..700
  Default 500 for UI; 600 for buttons and bold; 700 for emphasized stats.

Loaded from fonts.googleapis.com (preconnected in <head>).
```

### Type scale

| Token              | Size                              | Use case                              |
|--------------------|-----------------------------------|---------------------------------------|
| `display-xl`       | `clamp(3.5rem, 11vw, 9.5rem)`     | Hero headline. One per page.          |
| `display-lg`       | `clamp(2.5rem, 6.5vw, 5.25rem)`   | Section headlines.                    |
| `display-md`       | `clamp(1.75rem, 3.4vw, 2.75rem)`  | Sub-headlines, large card titles.     |
| `body-lg`          | `1.125rem` line-height 1.6        | Lead paragraph under hero/section.    |
| `body`             | `1rem` line-height 1.55           | Default body copy.                    |
| `body-sm`          | `0.92rem` line-height 1.5         | Footer, card-row captions.            |
| `micro`            | `0.78rem` letter-spacing 0.18em   | Uppercase eyebrows ("ДЛЯ КЛИЕНТОВ").  |

Display hierarchy collapses smoothly on small screens via `clamp` — the
hero stays oversized on desktop (9.5rem) but never overflows on a
360px phone (3.5rem floor).

## Spacing scale

Default Tailwind step (`0.25rem` = 4px). Section rhythm uses these
intentional values:

| Token                  | Value      | Use case                              |
|------------------------|------------|---------------------------------------|
| Section vertical pad   | `110px`    | `.section { padding: 110px 0 }`       |
| Hero top pad           | `96px`     | Desktop hero top breathing room.      |
| Hero bottom pad        | `48px`     | Hero → numbers band.                  |
| Container side pad     | `24px → 48px` | Mobile / desktop.                  |
| Card padding (step)    | `32px 28px` | Step cards.                          |
| Card padding (driver)  | `32px`     | Glass driver card on dark.            |
| Numbers band           | `40px 0`   | Tighter than section to feel "band".  |
| Final CTA              | `130px 0`  | Maximum breathing room before footer. |

## Radius scale

| Token        | Value    | Use case                              |
|--------------|----------|---------------------------------------|
| `radius-sm`  | `8px`    | Pills inside cards, small chips.      |
| `radius-md`  | `16px`   | Inputs, small cards.                  |
| `radius-lg`  | `24px`   | Step cards, driver card, phone-card peek. |
| `radius-xl`  | `28px`   | Compare cards.                        |
| `radius-2xl` | `36px`   | Hero panels, dark driver-section on desktop. |
| `radius-pill`| `999px`  | All CTA buttons, status pills.        |
| `radius-phone`| `42px`  | Mock phone hardware bezel only.       |

## Shadow / elevation

Avoid generic `0 4px 6px rgba(0,0,0,0.1)`. Brand shadows lean into the
ink-tint and pick up a faint teal halo for hero moments — analog
warmth, not corporate.

| Token          | Definition                                                                 | Use case                  |
|----------------|----------------------------------------------------------------------------|---------------------------|
| `shadow-soft`  | `0 6px 24px -8px rgba(15, 41, 55, 0.16)`                                   | Hover-lift on cards.      |
| `shadow-card`  | `0 24px 60px -24px rgba(15, 41, 55, 0.18), 0 4px 12px -4px rgba(15, 41, 55, 0.08)` | Resting elevation for floating cards. |
| `shadow-hero`  | `0 50px 100px -30px rgba(15, 41, 55, 0.35), 0 30px 60px -20px rgba(20, 184, 166, 0.20), inset 0 0 0 2px rgba(255,255,255,0.04)` | Phone mockup. Faint teal halo. |
| `shadow-cta`   | `0 8px 28px -10px rgba(15, 41, 55, 0.45)`                                  | Primary CTA buttons.      |
| `shadow-cta-hover`| `0 16px 32px -12px rgba(15, 41, 55, 0.55)`                              | CTA hover state.          |
| `inset-edge`   | `inset 0 0 0 1px rgba(15, 41, 55, 0.08)`                                   | Subtle hairline on light surfaces. |

## Button variants

All buttons share:
- `border-radius: 999px` (pill)
- `padding: 16px 26px`
- `font-weight: 700`
- `font-size: 0.95rem`
- `transition: transform 0.18s ease, background 0.2s ease, box-shadow 0.2s ease`
- `display: inline-flex; align-items: center; gap: 10px`

### Variants

| Variant       | Background        | Text          | Border               | Hover                                      |
|---------------|-------------------|---------------|----------------------|--------------------------------------------|
| `btn-primary` | `ink`             | `canvas`      | none + `shadow-cta`  | `bg: primary-deep`, lift -2px, deeper shadow |
| `btn-teal`    | `primary`         | `white`       | none + `shadow-cta`  | `bg: primary-deep`, lift -2px              |
| `btn-ghost`   | transparent       | `ink`         | `1.5px solid ink`    | invert (bg ink, text canvas), lift -2px    |
| `btn-coral`   | `coral`           | `ink`         | none                 | `bg: #FBA94A` (lighter coral), lift -2px   |

The dark `btn-primary` (ink + canvas text) is the page's default CTA —
its high contrast and editorial gravity beat a colored button at the
hero level. `btn-teal` is used inside the dark drivers-section where
the cream-vs-coral contrast is the local context.

## Card variants

### Step card (numbered how-it-works tiles)
- Background: `canvas-deep`
- Padding: `32px 28px`
- Radius: `24px`
- Min-height: `280px`
- Step numeral: Fraunces italic, 3.5rem, `primary`, 0.85 opacity
- Hover: lift -4px, background → `primary-tint`

### Driver card (income proof on dark)
- Background: `rgba(255, 255, 255, 0.04)` over `ink` parent
- Border: `1px solid rgba(255, 255, 255, 0.1)`
- Radius: `24px`
- Padding: `32px`
- Backdrop blur 8px — glass effect on dark
- Stat figure: Fraunces, 4rem, `canvas` color, coral for currency suffix

### Compare card (before/after WhatsApp vs Alif)
- "Bad" variant: transparent over canvas, ink-soft body, em-dash bullets
- "Good" variant: filled `primary`, white body, coral checkmark bullets
- Padding: `36px 32px`
- Radius: `28px`
- Border: `1px solid rule` (bad) / `1px solid primary` (good)

## Hero pattern

The hero is the page's identity moment. Layout:

```
.hero
  .hero-eyebrow         ← coral pulse dot + uppercase region label
  .hero-grid (1.4fr 1fr)
    .hero-text-col
      .hero-title       ← display-xl, Fraunces, with italic primary words
      .hero-sub         ← body-lg, ink-soft
      .hero-cta-row     ← btn-primary + btn-ghost
    .hero-phone-col
      .hero-ornament    ← radial primary-tint behind, transform/Y center
      .phone            ← ink hardware frame, -3deg rotation, shadow-hero
        .phone-screen   ← teal gradient inner
          .phone-status ← time + battery in canvas color
          .phone-map    ← animated route + start/end pins
          .phone-card   ← peek-sheet, canvas bg, ink/primary text
  .numbers              ← 4-stat band with coral punctuation
```

Key moves that make the hero distinctive:
1. **Italic primary in the headline** — `<em>` words swap to `primary-deep` italics
   with SOFT 100 axis. Visual stress lands on the conceptual nouns
   ("по селу", "город") not on a generic gradient.
2. **Coral punctuation on stat numerals** — the "%" / "″" / "/7"
   suffixes are coral, so the eye scans the numbers band as a rhythm
   strip not a wall of digits.
3. **Phone is tilted -3°** — small editorial photography move, breaks
   the right-angle grid that AI-generated landings default to.
4. **Cream + grain overlay** — the film-grain SVG at `mix-blend: multiply`
   stops the canvas from reading "plastic" on OLED.

## Motion

A single page-load orchestration. No scattered micro-interactions.

- `.reveal { opacity: 0; transform: translateY(28px); }`
- `.reveal.in { opacity: 1; transform: translateY(0); }`
- Transition: `0.85s cubic-bezier(0.2, 0.65, 0.25, 1)` on both axes
- Stagger via `.delay-1`..`.delay-5` (80ms steps)
- Triggered by `IntersectionObserver` (`threshold: 0.15`, `rootMargin: 0 0 -10% 0`)
- Falls back to instant-on if IO unavailable
- `prefers-reduced-motion: reduce` collapses to instant + kills route-draw / pulse / ping

Ambient continuous motion is reserved for two anchors:
- `.pulse` — coral 7px dot on hero-eyebrow, 1.8s expanding ring
- `.route-path` on phone-map — 3.5s `stroke-dashoffset` draw, infinite alternate

## Film grain / atmosphere

A single SVG-noise overlay sits over the entire page (`body::before`):
- `mix-blend-mode: multiply`, `opacity: 0.45`
- `pointer-events: none`, `z-index: 100` (above content, below modals)
- Inline base64 SVG (no extra request)

This is what separates the page from the "flat cream over white" AI
default. Don't remove it.

## File map

- `resources/css/app.css` — Tailwind v4 imports + `@theme` token registration
- `resources/css/design-system.md` — this document
- `resources/views/landing.blade.php` — public landing page (`/`)
- `resources/views/welcome.blade.php` — fallback brand splash, unused by routes
- `resources/views/legal/privacy.blade.php` — privacy page, follows same palette
- `mobile/packages/shared/src/theme/colors.ts` — mobile parity source

When the palette changes here, update both `app.css` `@theme` tokens
*and* `colors.ts`. Drifting them produces visible cross-platform
inconsistency — same brand teal on the phone vs. the website matters
for trust.
