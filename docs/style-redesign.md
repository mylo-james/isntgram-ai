# Style Redesign

Scope: Style-only rough draft. No architecture or component API changes. Semi-similar to legacy visuals, modernized for
clarity, accessibility, and polish.

## Visual Identity

- Vibe: Clean, light, friendly. Subtle gradients, soft neutrals, restrained motion.
- Tone: Playful but professional; emphasize clarity and legibility.

## Color System

- Neutrals
  - Background: #FFFFFF (base), #F9FAFB (subtle surface)
  - Border: #E5E7EB
  - Text: #111827 (primary), #6B7280 (secondary), #9CA3AF (tertiary)
- Primary
  - Blue: #3B82F6 (default), #2563EB (hover/active)
  - Optional gradient CTA: from #7C3AED to #EC4899
- Accents
  - Indigo #6366F1, Pink #EC4899, Purple #8B5CF6
- Status
  - Success #10B981, Warning #F59E0B, Danger #EF4444
- Focus
  - Ring: 2px #2563EB with subtle halo #93C5FD

## Typography

- Font: Geist Sans (preferred) → Inter/System fallback
- Scale: 16px base; minor third ratio (~1.125)
  - Display 32–40, H1 28, H2 24, H3 20, Body 16, Small 14, Micro 12
- Weights: 400/500/600 (headings 500–600; body 400)
- Line-height: 1.45–1.6 for body; headings 1.2–1.35

## Spacing, Radius, Elevation

- Spacing: 4, 8, 12, 16, 24, 32, 48
- Radius: 8px default; 12px cards/modals; 9999px for pills/avatars
- Shadows: Prefer subtle borders + light shadows
  - Card: shadow-sm + 1px border
  - Modal: shadow-lg + 60% overlay

## Iconography

- Set: Lucide or Remix Icons (1.5–2px strokes)
- Sizing: 16 / 20 / 24; use secondary text color for idle

## Core Components (Visual only)

- Buttons
  - Primary: Blue 500 → 600 on hover; white text
  - Secondary: White bg, gray border, gray-800 text
  - Quiet/Text: Blue text; underline on hover
  - Destructive: Red 500 → 600 on hover
  - Disabled: 60% opacity; no hover state
  - Focus: 2px blue ring (offset 2px)
- Inputs
  - Field: White bg, #E5E7EB border, 8px radius, 14–16px type
  - Focus: 1px #2563EB ring; border shifts to #93C5FD
  - Error: Border/text #EF4444; helper text small red
- Cards
  - White bg; 1px #E5E7EB border; 12px radius; shadow-sm; 16–24px padding
- Modals
  - Surface 12px radius; shadow-lg; overlay rgba(0,0,0,0.6)
  - Enter: fade + 98%→100% scale (180ms); Exit: fade (150ms)
- Navigation
  - Top (desktop): white bar, thin bottom border; active item blue
  - Bottom (mobile): white bar, thin top border; evenly spaced icons; active blue
- Avatars
  - Sizes 24/32/40/64; optional 1px #E5E7EB ring; object-cover
- Chips/Pills
  - Soft gray bg #F3F4F6; 9999px radius; 12–14px text
- Toasts
  - Top-right; success green, error red, neutral gray; 3–5s auto-close
- Skeletons
  - Neutral blocks with shimmer gradient (L→R, ~1200ms)

## Imagery & Media

- Post thumbnails
  - object-cover; square crop; 4–8px radius
  - Hover overlay: 30% black with white like/comment counters
- Full post
  - Card surface; capped width (~600px); consistent 16–24px paddings
- Profile
  - Prominent avatar; 1px grid gaps; friendly empty states

## Motion

- Durations: 150–250ms for hover/focus; 180–220ms for modals
- Easing: ease-out on enter; ease-in on exit
- Micro-interactions: icon tap “pop” (scale 0.98→1), subtle fade on lists

## Dark Mode (Draft)

- Background #0B0F19; Surface #111827
- Text #E5E7EB primary; #9CA3AF secondary
- Borders #1F2937
- Primary blue shifts to #60A5FA; hover #93C5FD
- Maintain contrast ≥ 4.5:1 on interactive text

## Accessibility

- Contrast: All interactive text ≥ 4.5:1
- Focus: Visible, not color-only (ring + slight offset)
- Hit areas: Minimum 40px target size on touch
- Motion: Respect reduced motion preference

## Suggested Tokens (CSS variables)

```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;

  --c-bg: #ffffff;
  --c-surface: #f9fafb;
  --c-border: #e5e7eb;
  --c-text: #111827;
  --c-text-2: #6b7280;

  --c-primary: #3b82f6;
  --c-primary-hover: #2563eb;
  --c-gradient-from: #7c3aed;
  --c-gradient-to: #ec4899;

  --c-success: #10b981;
  --c-warn: #f59e0b;
  --c-danger: #ef4444;

  --ring: 2px solid #2563eb;
}
```

Notes

- This is a visual direction only; adapt tokens into Tailwind or your design system as needed.
- Aligns loosely with legacy aesthetics while prioritizing modern readability and accessibility.
