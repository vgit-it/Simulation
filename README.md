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

Boot flow: **lock → unlock → home → Photos → tap a photo → Share → Send**.
Photos are grouped by time ("This Week" / "Earlier") and each photo lists the
people in it — all from committed metadata, never image analysis. Sharing routes
through an assistant proposal (recipients + a drafted message you approve); sent
items persist (localStorage) and can be wiped with **Reset world**.

Run tests with `npm run test`.

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
  world/                   # loaders + zod schemas (parse world/ → typed seed World)
  state/                   # runtime state: event log + reducer + store (mutable)
  session/                 # POV: which person/device is embodied (+ switch)
  intelligence/            # person brains behind one swappable interface
  context/                 # assembleContext → bundle a decider consumes
  actions/                 # propose/commit pipeline + approve/send sheet
  phone/                   # device frame, status bar, lock/home, router, dev bar
  apps/                    # app registry + Photos renderer
  theme/                   # theme tokens → CSS variables
  config.ts                # sim start clock, hero person/device, provider choice
```

Data flow: `world/` files → validated loader → typed **seed** `World`;
`src/state` holds mutable runtime state (event log → derived). The phone reads
the embodied POV (`src/session`), renders apps, and apps ask the person's
**brain** (`src/intelligence`) for derived results and the **action pipeline**
(`src/actions`) to propose/commit effects back into the store.

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

- **Content ≠ code** — grow the world by editing `world/` (read-only seed).
- **Runtime state = event log** — everything mutable is a persisted event;
  derived state is a fold. Reset wipes it back to the seed.
- **One action pipeline** — `propose → Proposal → commit` serves the assistant
  and (later) scenarios alike.
- **Adapter boundary** for intelligence — mock now, LLM later, same interface.
- **Deterministic** — time comes from the store clock, not the wall clock; no
  perception, no tokens.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, extension recipes, and
milestone plan.

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on
push to `main`. Enable it once under **Settings → Pages → Source: GitHub
Actions**. The build uses a relative base path, so it works from a project
subpath and can be opened on a real phone.

## Roadmap

- **M1** ✅ Phone shell + Photos.
- **M1.5** ✅ Foundation: runtime state/event log, action pipeline + approve/send,
  context assembly, session/POV, person-scoped brains, tests.
- **M2** Assistant surface — persistent entry point, multi-select share, activity view.
- **M3** Multiple people + contacts graph.
- **M4** Scenarios that play sequences across people/devices.
- **M5** Real LLM provider behind the intelligence interface.
- **M6** More device shells (watch, glasses, appliances) + generated visuals.
