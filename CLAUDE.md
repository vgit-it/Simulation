# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

> **This is living documentation — keep it current.** It is the single source
> of truth for how this project works and where it's going. Whenever a change
> makes something here inaccurate, update it **in the same change**:
> - **Milestones:** when a milestone lands, mark it ✅ and move the "next"
>   pointer forward; add or re-scope milestones as plans evolve.
> - **Architecture / layout / data flow:** update when files, layers, or the
>   flow between them change.
> - **Principles & conventions:** update if a rule is added, dropped, or
>   changed (and make the code match).
> - **Recipes & commands:** update when the steps to extend the project or the
>   npm scripts change.
> Treat a PR that changes behavior but leaves this file stale as incomplete.
> When in doubt, err toward updating it.

## What this project is

**Simulation** is a simulated world of people and their devices (phones, and
later watches, glasses, appliances), visualized through an **interactive
simulated-phone web UI**. It runs as a static site (GitHub Pages) and is meant
to be opened on a real phone.

Nothing here is a "real" app. The whole thing is deliberate smoke and mirrors:

- **Apps are Markdown definitions**, not working software — a `.md` file with
  YAML frontmatter describing an app's capabilities/actions.
- **User files (photos, documents) are plain files** in the repo, each carrying
  a **metadata sidecar** that holds the "truth" (who's in a photo, when, where).
  The pixels are irrelevant placeholders.
- **The "intelligence" is a pluggable adapter.** It starts fully **mocked and
  deterministic** (no LLM calls, no tokens spent) and can be swapped for a real
  LLM later **without touching the UI**.
- **No real perception.** "Who is in this photo" or "which photos are from this
  week" comes from committed metadata against a fixed simulation clock — never
  image analysis, never the wall clock.

The end goal is to define multiple people with different behaviors, wire their
devices, run scenarios across them, and let a user drive one person's phone as
an interactive prototype (with the rest of the simulated world as their
contacts, photos, etc.).

## Core principles (do not violate)

1. **Content ≠ code.** Growing the world means editing `world/`, never `src/`.
   If a change to the world requires editing engine code, the engine is missing
   an abstraction — add the abstraction instead of special-casing content.
2. **Everything smart goes through the intelligence adapter.** Any derived /
   "smart" result the UI shows must come from `IntelligenceProvider`
   (`src/intelligence/`). Never hardcode a smart result in a component, and never
   call an LLM directly from a component.
3. **Deterministic by default.** Use the simulation clock (`SIM_NOW` in
   `src/config.ts`), not `Date.now()`. The world must behave identically no
   matter when it runs.
4. **Modular & additive.** Adding an app, theme, person, or device should be
   drop-a-file (+ at most one registry line). Prefer registries and data over
   conditionals.
5. **Validate loudly.** All authored content is schema-checked on load (`zod`).
   Malformed files must fail with the file path and the exact problem, not
   silently mis-render.
6. **No tokens unless asked.** The default provider is `mock`. Do not wire real
   LLM calls unless the task explicitly calls for it.

## Tech stack

- **React 18 + TypeScript + Vite** (static build for GitHub Pages).
- **Tailwind CSS** with theme tokens exposed as CSS variables.
- **zod** for content schemas, **js-yaml** for frontmatter + sidecars.
  - Note: we parse frontmatter with `js-yaml` directly (see
    `src/world/frontmatter.ts`) rather than `gray-matter`, which depends on
    Node's `Buffer` and breaks in the browser bundle.
- File discovery is **Vite `import.meta.glob`** (build-time) — there is no
  runtime filesystem code.

## Commands

```bash
npm install
npm run dev        # dev server
npm run build      # tsc -b && vite build  (must pass before committing)
npm run preview    # serve the production build
npm run typecheck  # types only
```

## Repository layout

```
world/                         # CONTENT — authored, no code
  apps/<app>.md                # app definition (frontmatter: capabilities/actions)
  people/<person>/
    profile.md                 # id, name, avatar, traits, behaviors
    contacts.md                # contacts (name/avatar records)
    devices/<device>.md        # type, name, theme, installed apps[]
    files/
      gallery/<id>.svg         # placeholder image
      gallery/<id>.yaml        # metadata sidecar: date, location, people[], tags[]
      documents/               # (reserved)
  themes/<theme>.md            # visual identity tokens (colors, radii, font)
  scenarios/                   # (reserved for M3)
src/
  config.ts                    # SIM_NOW, BOOT_PERSON/DEVICE, provider choice
  world/                       # loaders + zod schemas -> typed World + selectors
    frontmatter.ts             # browser-safe frontmatter/YAML parsing
    schema.ts                  # zod schemas + inferred types
    loader.ts                  # import.meta.glob discovery -> World
    index.ts                   # World selectors (getPerson/getDevice/getApp/...)
  intelligence/                # IntelligenceProvider interface + MockIntelligence
    types.ts                   # the adapter contract
    mock.ts                    # deterministic implementation
    index.ts                   # provider selection (config-driven)
  theme/                       # theme tokens -> CSS variables
  phone/                       # DeviceFrame, StatusBar, LockScreen, HomeScreen, Phone
  apps/                        # app registry + app renderers
    registry.ts                # appId -> React renderer
    types.ts                   # AppScreenProps
    photos/                    # the Photos app (M1)
  App.tsx                      # stage: centers the booting device
  main.tsx                     # React entry
.github/workflows/deploy.yml   # build + deploy to GitHub Pages on push to main
```

### Data flow

`world/` files → validated loader (`src/world`) → typed `World` object → phone
shell (`src/phone`) renders apps → apps ask the intelligence adapter
(`src/intelligence`) for derived results.

## How to extend (recipes)

**Add a photo:** drop `img-00N.svg` + `img-00N.yaml` into a person's
`files/gallery/`. It appears automatically (loader joins them by basename).

**Restyle a device:** edit the tokens in the device's theme file
(`world/themes/*.md`). No code changes.

**Add a person:** create `world/people/<id>/profile.md` (+ optional
`contacts.md`, `devices/`, `files/`). Ids are kebab-case and must match the
folder name.

**Add a device to a person:** add `world/people/<id>/devices/<device>.md` with a
`theme` and an `apps: [...]` list.

**Add a new app:**
1. Author `world/apps/<app>.md` (frontmatter: `id`, `name`, `icon`, `category`,
   `capabilities`, `actions`).
2. Create a renderer under `src/apps/<app>/` implementing `AppScreenProps`
   (`src/apps/types.ts`).
3. Register it in `src/apps/registry.ts` (one line).
4. Add the app id to a device's `apps:` list so it appears on the home screen.

**Add intelligence:** extend the `IntelligenceProvider` interface
(`src/intelligence/types.ts`), implement it in `MockIntelligence`
(`src/intelligence/mock.ts`), and call it from the app. Never bypass the
interface.

## Content conventions

- **Ids** are kebab-case and stable (they are referenced across files, e.g. a
  photo's `people:` list references person/contact ids).
- **Dates** are ISO (`YYYY-MM-DD`) and interpreted against `SIM_NOW`.
- **Frontmatter** is fenced with `---` and must satisfy the matching schema in
  `src/world/schema.ts`. If you add a field, add it to the schema too.
- A photo's image and metadata share a basename (`img-001.svg` ↔
  `img-001.yaml`); a metadata file with no matching image is a hard error.

## Verification (before committing non-trivial changes)

1. `npm run build` passes (typecheck + build).
2. Drive the real flow (browser or headless Playwright): **lock → unlock → home
   → open the app → interact**. Confirm no console errors.
3. For content changes, confirm the new/edited content renders and that removing
   the code did not require engine edits (content ≠ code).

Chromium is preinstalled at `/opt/pw-browsers`; a global `playwright` is
available. Prefer driving the running `npm run preview` build for end-to-end
checks.

## Deployment

`.github/workflows/deploy.yml` builds `dist/` and publishes to GitHub Pages on
push to `main`. Enable it once under **Settings → Pages → Source: GitHub
Actions**. The Vite `base` is relative (`./`) so the build works from a project
subpath and on a real phone.

## Milestones

### M1 — Phone shell + Photos ✅ (current)

Interactive phone (lock → home → app), one seed person (Ava), and the **Photos**
app: a time-grouped gallery whose grouping and "people in photo" come from the
mock intelligence + metadata. Themeable, content-driven, deployable.

### M2 — Assistant approve/send surface (next)

A visible assistant overlay where the intelligence **proposes an action** and the
user confirms with one tap. Example: "Share these 5 photos with Sam & Ava" →
tap **Send**. Introduce `share-photos` on the adapter (already named in
`world/apps/photos.md` actions), a proposal/preview UI, and a lightweight
"sent"/activity record. Still deterministic; the adapter drafts the message and
picks recipients from photo metadata.

### M3 — Multiple people + contacts graph

Several seed people, each with their own device(s). Photo `people:` resolve to
real people in the world (not just lightweight contacts), enabling cross-person
references and laying groundwork for scenarios.

### M4 — Scenarios

`world/scenarios/*` describe sequences of interactions across people/devices; a
runner plays them and visualizes each device's screen state. Useful for demoing
"how things would happen" without manual clicking.

### M5 — Real LLM provider

Implement `LLMIntelligence` behind the existing `IntelligenceProvider` interface
and select it via config. Decide the key strategy at that point (client-side key
vs. serverless proxy) — GitHub Pages is static-only, so a real backend requires a
serverless function. Keep the mock as the default/offline provider.

### M6 — More device shells & richer visuals

Watch / glasses / appliance frames reusing the app + theme registries; optional
image generation for scenario output.

## Things to keep in mind for future work

- The style/visual identity is meant to be author-defined via theme tokens and
  (later) style guides — keep visual decisions in `world/themes/` and
  `src/theme/`, not scattered in components.
- When adding LLM calls (M5), preserve determinism as an option: the mock must
  remain a working, token-free provider so the world is always runnable offline.
- Prefer extending schemas and registries over adding conditionals; the codebase
  should stay "add a file, it shows up."
