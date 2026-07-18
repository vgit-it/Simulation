---
name: verify
description: Build, serve, and drive the simulated-phone UI headlessly to verify changes end-to-end.
---

# Verifying changes in this repo

The surface is the phone UI (GUI): serve the production build and drive it
with Playwright, screenshotting the states the diff touches.

## Recipe that works

```bash
npm run build                 # tsc -b && vite build
npm run preview &             # serves dist/ on http://localhost:4173
```

Playwright is a **global** install (`/opt/node22/lib/node_modules/playwright`),
not a project dep — import it by absolute path in a scratch script:

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
```

Do **not** run `playwright install` (browsers are preinstalled at
`/opt/pw-browsers`).

## Flows worth driving

- Start clean: `localStorage.clear()` + reload (the event log persists).
- Unlock: click the lock screen (`page.mouse.click(210, 800)` works), wait
  ~700ms for the transition.
- Assistant: `button[aria-label="Open assistant"]` → sheet with Suggestions /
  Ask (chat input placeholder `Ask the assistant...`) / Recent activity.
- Plan flow: submit "share this week's photos" → PlanSheet ("Assistant ·
  Plan") → pick a supervision level → "Run plan" → PlanProgress HUD →
  completion.
- Probes that matter here: reload persistence (log survives), Reset world
  clears, `reducedMotion: 'reduce'` context (all motion must collapse),
  collect `console`/`pageerror` events and assert none.

## Gotchas

- Screens animate; sprinkle 300–900ms waits after navigation taps.
- POV switching re-locks the phone (by design), so re-unlock after embodying
  someone else.
