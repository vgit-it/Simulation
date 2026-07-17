---
version: alpha
name: Simulation OS
description: >-
  The operating-system design language shared by every simulated device.
  Typography, spacing, and shape live here; per-person color identity lives in
  world/themes/*.md. Edit this file to restyle the OS — no code changes needed.
fonts:
  # Figtree stands in for Google Sans (which is proprietary): the same warm
  # geometry — near-circular counters, generous x-height, friendly terminals.
  brand: "'Figtree Variable', 'Figtree', 'Google Sans', system-ui, sans-serif"
  # The workhorse text face. The brand face is a display face and loses
  # legibility below ~14px, so small sizes always use this one.
  plain: "'Inter Variable', 'Inter', 'Roboto', system-ui, sans-serif"
typography:
  display:
    fontFamily: '{fonts.brand}'
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.025em
  headline:
    fontFamily: '{fonts.brand}'
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  title:
    fontFamily: '{fonts.brand}'
    fontSize: 19px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.01em
  body:
    fontFamily: '{fonts.plain}'
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  body-sm:
    fontFamily: '{fonts.plain}'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0.01em
  label:
    fontFamily: '{fonts.brand}'
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.02em
  caption:
    fontFamily: '{fonts.plain}'
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0.04em
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
rounded:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  full: 999px
---

## Overview

This design language follows the philosophy of **Google Sans typography**: the
shift from type that is engineered to disappear (the Roboto era) to type that
is *designed to be recognized*. The brand face carries the personality —
perfectly circular counters, a generous x-height, almost-too-friendly rounded
terminals — and says "we're approachable" with confidence. Everything else
stays quiet so it can.

Three rules fall out of that philosophy:

1. **The brand face is for moments, not paragraphs.** Display, headlines,
   titles, and labels use it; running text never does.
2. **Hierarchy comes from size, weight, and color — never decoration.** No
   underlines, boxes, or ALL CAPS headings.
3. **Whitespace is part of the voice.** Friendly type needs room; when in
   doubt, add space rather than a divider.

Colors are deliberately absent from this file: they are *personal* identity in
this world, authored per resident in `world/themes/*.md`. This file is the
*OS* identity every resident shares.

## Typography

The scale has seven roles. Sizes at or above 19px use the brand face
(`fonts.brand`); 15px and below use the plain face (`fonts.plain`) — with one
exception, `label`, which stays in the brand face because buttons and pills
are brand moments even at small sizes.

| Role      | Face  | Size | Weight | Line | Tracking  | Used for                          |
| --------- | ----- | ---- | ------ | ---- | --------- | --------------------------------- |
| display   | brand | 64px | 700    | 1.05 | −0.025em  | the lock-screen clock             |
| headline  | brand | 30px | 700    | 1.15 | −0.02em   | greetings, app large titles       |
| title     | brand | 19px | 500    | 1.25 | −0.01em   | section headers, thread names     |
| body      | plain | 15px | 400    | 1.5  | 0         | messages, running text            |
| body-sm   | plain | 13px | 400    | 1.45 | +0.01em   | secondary text, previews          |
| label     | brand | 13px | 500    | 1.3  | +0.02em   | buttons, pills, tabs              |
| caption   | plain | 11px | 500    | 1.35 | +0.04em   | timestamps, metadata              |

Tracking follows the classic display-face curve: **tight at large sizes**
(negative tracking amplifies the friendly geometry), opening up as sizes
shrink (small text needs air to stay legible).

**Weights: exactly three — 400, 500, 700.** Regular for reading, medium for
structure, bold for the brand moments. Never introduce a fourth.

## Layout

Everything sits on an **8px grid with a 4px half-step** for micro-adjustments
(the `spacing` scale above). Screen edges get `lg` (16px) minimum; headline
areas get `xl`/`2xl` so large type has the whitespace the philosophy demands.
Group related content with proximity, separate with space — hairlines only
when scrolling containers truly need an edge.

## Shapes

Corners are round and friendly, matching the circular counters of the type:
`xs` for thumbnails and small chips, `sm` for cards inside lists, `md` for
cards and grouped surfaces, `lg` for sheets and modal surfaces, `full` for
pills and buttons. The device screen and per-theme card radius remain theme
tokens (`world/themes/*.md`) since they are part of a resident's identity.

## Components

- **Pills / buttons** — `label` typography, `rounded.full`, horizontal padding
  ≥ `lg`. Primary actions fill with the theme accent; secondary ones use a
  translucent text tint.
- **Sheets** — top corners `rounded.lg`, content padding `xl`, a grabber, and
  `title` typography for their heading.
- **List rows** — `body` for the primary line, `body-sm`/`caption` muted for
  the secondary, `lg` horizontal padding, vertical rhythm on the 8px grid.
- **Section headers** — `title` (or `caption` muted for in-list group labels
  like photo date groups), never bolder than the content they introduce.

## Do's and Don'ts

- **Do** let the brand face do the talking at large sizes; keep everything
  else quiet.
- **Do** use muted color (theme `muted`) for secondary text instead of
  shrinking it further.
- **Don't** set running text in the brand face, or anything below 11px.
- **Don't** add a fourth weight, letterspace body text, or use ALL CAPS for
  emphasis.
- **Don't** reach for dividers where whitespace can group content.
