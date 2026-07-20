---
version: alpha
name: Simulation OS
description: >-
  The operating-system design language shared by every simulated device,
  modeled on Samsung One UI (7/8): one system typeface with weight-driven
  hierarchy, very round "squircle" shapes, and a reachability-first layout.
  Typography, spacing, and shape live here; per-person color identity lives in
  world/themes/*.md. Edit this file to restyle the OS — no code changes needed.
fonts:
  # Onest stands in for One UI Sans (which is proprietary): the same
  # geometric-humanist skeleton — tall x-height, slightly narrow, open
  # apertures, quiet terminals. One UI uses a single family everywhere,
  # so brand and plain resolve to the same face; hierarchy comes from
  # size and weight alone.
  brand: "'Onest Variable', 'Onest', 'One UI Sans', 'SamsungOne', 'Roboto', system-ui, sans-serif"
  plain: "'Onest Variable', 'Onest', 'One UI Sans', 'SamsungOne', 'Roboto', system-ui, sans-serif"
typography:
  display:
    fontFamily: '{fonts.brand}'
    fontSize: 72px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: -0.03em
  headline:
    fontFamily: '{fonts.brand}'
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  title:
    fontFamily: '{fonts.brand}'
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0em
  body:
    fontFamily: '{fonts.plain}'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0em
  body-sm:
    fontFamily: '{fonts.plain}'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
  label:
    fontFamily: '{fonts.brand}'
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0em
  caption:
    fontFamily: '{fonts.plain}'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: 0.01em
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
rounded:
  xs: 12px
  sm: 16px
  md: 22px
  lg: 26px
  full: 999px
---

## Overview

This design language follows **Samsung One UI** (the 7/8-era redesign): an OS
built for very large screens held in one hand. Three convictions drive every
value in this file:

1. **One typeface, weight does the work.** One UI sets everything — clocks,
   titles, body, buttons — in a single family (One UI Sans; Onest here).
   Hierarchy comes from size and weight, never from switching faces. The
   result is calm and unmistakably Samsung.
2. **Reachability.** Content belongs in the bottom two-thirds of the screen
   where a thumb can reach. Large headers are *tall on purpose* — the title
   sits low in a generous area, pushing interactive content down.
3. **Round is the brand.** One UI's geometry matches its squircle app icons:
   26px cards, pill buttons, circle avatars. Big continuous curves make
   grouped "card lists" the signature surface — white cards floating on a
   soft gray canvas (light) or dark-gray cards on true black (dark).

Colors are deliberately absent from this file: they are *personal* identity in
this world, authored per resident in `world/themes/*.md` (all of which follow
the One UI neutral system — gray/white canvas in light, black/#171717 in dark —
differing only in accent). This file is the *OS* identity every resident
shares.

## Typography

The scale has seven roles, all one family. One UI's sizes are slightly larger
than other platforms — body text is 16px, secondary 14px — because the canvas
is a big screen viewed at arm's length.

| Role      | Size | Weight | Line | Tracking | Used for                          |
| --------- | ---- | ------ | ---- | -------- | --------------------------------- |
| display   | 72px | 700    | 1.0  | −0.03em  | the lock-screen clock             |
| headline  | 28px | 700    | 1.2  | −0.01em  | large collapsing app-bar titles   |
| title     | 18px | 500    | 1.3  | 0        | section headers, thread names     |
| body      | 16px | 400    | 1.45 | 0        | messages, list rows, running text |
| body-sm   | 14px | 400    | 1.4  | 0        | secondary text, previews          |
| label     | 14px | 500    | 1.3  | 0        | buttons, pills, tabs              |
| caption   | 12px | 400    | 1.35 | +0.01em  | timestamps, metadata              |

Tracking is near-neutral — One UI Sans is drawn to sit naturally; only the
huge lock clock tightens (−0.03em) and captions open slightly for legibility.

**Weights: exactly three — 400, 500, 700.** Regular for reading, medium for
labels and structure, bold for titles and the clock. Never introduce a fourth.

## Layout

Everything sits on an **8px grid with a 4px half-step** (the `spacing` scale
above). Screen edges get `lg` (16px) minimum; One UI's grouped card lists
inset a further `lg` inside each card. Large-title header areas get `xl`/`2xl`
vertical padding so the title visibly sits *low* — reachability is a layout
value, not a slogan. Group related rows inside one rounded card, separate
groups with space; hairline dividers appear only inside a card between rows,
never between cards.

## Shapes

Corners are One UI's signature — big, continuous, everywhere: `xs` (12px) for
thumbnails and small chips, `sm` (16px) for tiles inside grids, `md` (22px)
for app icons and standalone cards, `lg` (26px) for grouped list cards,
sheets, and pop-ups, `full` for pills, buttons, search bars, and the Now
Bar. The device screen radius and per-theme card radius remain theme tokens
(`world/themes/*.md`); Galaxy hardware corners are squarer than other phones
(~30px screen radius).

## Components

- **Pills / buttons** — `label` typography, `rounded.full`, horizontal padding
  ≥ `lg`. Primary actions fill with the theme accent (white text); secondary
  ones are tonal — a translucent text tint on the surface.
- **Sheets / pop-ups** — corners `rounded.lg`, content padding `xl`, a
  grabber. One UI pop-ups float with a scrim; sheets slide from the bottom.
- **Card lists** — the One UI signature: a group of related rows wrapped in
  one `rounded.lg` surface-colored card on the canvas. Rows get `body` primary
  text, `body-sm` muted secondary, `lg` padding.
- **Section headers** — `caption` muted, set *outside* the card above it,
  never bolder than the content they introduce.
- **App icons** — squircles: `rounded.md` on a ~56px tile, surface-colored,
  label in `caption` beneath.

## Do's and Don'ts

- **Do** put content in cards on the canvas; the bare canvas color showing
  between cards *is* the One UI look.
- **Do** use muted color (theme `muted`) for secondary text instead of
  shrinking it further.
- **Don't** mix typefaces — one family, three weights, no exceptions.
- **Don't** use small corner radii on visible surfaces; if it looks safe to
  round more, round more.
- **Don't** letterspace body text or use ALL CAPS for emphasis.
