# Simulation

A simulated world of people and their devices, visualized through an
**interactive simulated-phone** web UI. Nothing under the hood is a real app —
apps are Markdown definitions, files are placeholders with metadata, and the
"intelligence" is a pluggable adapter that starts fully mocked (no LLM tokens
spent) and can be swapped for a real model later.

This is **Milestone 1**: the phone shell + one app (**Photos**), driven entirely
by authored content.

## Quick start

```bash
npm install
npm run dev      # open the printed localhost URL
npm run build    # production build to dist/
npm run preview  # serve the production build
```

Boot flow: **lock screen → tap to unlock → home screen → Photos → tap a photo**.
Photos are grouped by time ("This Week" / "Earlier") and each photo lists the
people in it — all derived from committed metadata, never image analysis.

## How it's organized

Content and code are strictly separated so the world can grow without touching
the engine.

```
world/                     # CONTENT — authored, no code
  apps/photos.md           # app definition (frontmatter capabilities/actions)
  people/ava-chen/
    profile.md             # who they are
    contacts.md            # who they know
    devices/phone.md       # a device: theme + installed apps
    files/gallery/         # img-00N.svg + img-00N.yaml (metadata sidecar)
  themes/midnight.md       # visual identity as tokens
src/
  world/                   # loaders + zod schemas (parse world/ → typed World)
  intelligence/            # IntelligenceProvider interface + MockIntelligence
  phone/                   # device frame, status bar, lock/home, router
  apps/                    # app registry + Photos renderer
  theme/                   # theme tokens → CSS variables
  config.ts                # sim clock, which device boots, provider choice
```

Data flow: `world/` files → validated loader → typed `World` → phone shell
renders apps → apps ask the **intelligence adapter** for smart/derived results.

## Authoring (no code required)

- **Add a photo**: drop `img-00N.svg` + `img-00N.yaml` into a person's
  `files/gallery/`. It appears automatically.
- **Restyle a device**: edit the tokens in `world/themes/*.md`.
- **Add an app to a device**: list its id under `apps:` in the device file
  (the app needs a definition in `world/apps/` and a renderer registered in
  `src/apps/registry.ts`).

Every world file is schema-validated on load, so a malformed file fails loudly
with the file path and the exact problem.

## Design principles

- **Content ≠ code** — grow the world by editing `world/`.
- **Registries** for apps and themes — adding one is drop-a-file + one line.
- **Adapter boundary** for intelligence — mock now, LLM later, same interface.
- **Deterministic** — a fixed simulation clock (`src/config.ts`) so behavior is
  identical whenever it runs; no perception, no tokens.

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on
push to `main`. Enable it once under **Settings → Pages → Source: GitHub
Actions**. The build uses a relative base path, so it works from a project
subpath and can be opened on a real phone.

## Roadmap (beyond M1)

1. Assistant surface (propose an action → tap Okay/Send).
2. Multiple people + a contacts graph.
3. Scenarios that play sequences across people/devices.
4. Real LLM provider behind `IntelligenceProvider`.
5. More device shells (watch, glasses, appliances).
