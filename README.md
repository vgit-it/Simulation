# Simulation

A simulated world of people and their devices, visualized through an
**interactive simulated-phone** web UI. Nothing under the hood is a real app —
apps are Markdown definitions, files are placeholders with metadata, and the
"intelligence" is a pluggable adapter that starts fully mocked (no LLM tokens
spent) and can be swapped for a real model later.

**Primary mode: Gemini (API).** The assistant's "brain" is a swappable adapter
— mock, an llm-dry-run inspector, and a real **Gemini**-backed provider
(Settings ▸ Brain, bring-your-own API key) — but **Gemini is the mode this
project is built and verified against going forward**, not the other two. The
mock stays the zero-setup, offline, token-free default so a fresh clone or the
deployed site works with no key, but treat it as a fallback mirror, not the
design target — see `CLAUDE.md`'s "Development focus" section.

Through **Milestone 4** it's a multi-person world: six residents with their own
themed phones and galleries, a **Photos** app, a persistent **assistant**, a
**Messages** inbox where shares actually arrive, and now scripted **scenarios**
that play a sequence of interactions across people/devices — all driven by
authored content.

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

Then use the **POV switcher** in the dev bar to embody a recipient and open
**Messages** — the share you just sent is waiting in their inbox (thread view
with photo thumbnails). **Contacts** shows each person's graph, derived from who
they co-appear with in photos.

Or let it play itself: pick a scenario in the **ScenarioBar** (next to the dev
bar) and hit **Step** or **Play** — the phone frame hops between actors as the
script runs (Ava shares, the clock advances, focus cuts to the recipients'
Messages app), dispatching the exact same `propose`/`commit` calls a human tap
would.

The assistant sheet also has an **Ask** box — a free-form chat backed by the
same deterministic mock brain (ask about sharing this week's photos, or about
a contact by name). It's the harness a real model will plug into later; today
it's a scripted stand-in, not a network call.

Run tests with `npm run test`.

## How it's organized

Content and code are strictly separated so the world can grow without touching
the engine.

```
world/                     # CONTENT — authored, no code
  apps/{photos,messages,contacts}.md   # app definitions (frontmatter)
  people/<person>/         # six residents, each a full person
    profile.md             # who they are
    devices/phone.md       # a device: theme + installed apps
    files/gallery/         # img-00N.svg + img-00N.yaml (metadata sidecar)
  themes/<theme>.md        # visual identity as tokens (one per resident)
  scenarios/<scenario>.md  # scripted step sequences (clock/focus/share)
src/
  world/                   # loaders + zod schemas + graph (contactsOf/resolveAsset/getScenario)
  state/                   # runtime state: event log + reducer + store (mutable)
  session/                 # POV: which person/device is embodied (+ person/device switch)
  intelligence/            # person brains behind one swappable interface
  context/                 # assembleContext → bundle a decider consumes
  actions/                 # propose/commit pipeline + approve/send sheet
  assistant/               # persistent ✨ assistant: suggestions + activity
  scenarios/               # pure step runner (resolveStep) + ScenarioBar player UI
  phone/                   # device frame, status bar, lock/home, router (controlled screen), dev bar
  apps/                    # app registry + Photos / Messages / Contacts renderers
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
- **Adapter boundary** for intelligence — mock, llm-dry-run, and **Gemini**
  share one interface; Gemini is the primary target, mock is the offline/test
  fallback.
- **Deterministic** — time comes from the store clock, not the wall clock; no
  perception, no tokens.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, extension recipes, and
milestone plan, and [`TASK_SYSTEM.md`](./TASK_SYSTEM.md) for the design of the
unified **task system** (simple + complex tasks, elicitation, confidence-graded
inference, the task stack).

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on
push to `main`. Enable it once under **Settings → Pages → Source: GitHub
Actions**. The build uses a relative base path, so it works from a project
subpath and can be opened on a real phone.

## Roadmap

- **M1** ✅ Phone shell + Photos.
- **M1.5** ✅ Foundation: runtime state/event log, action pipeline + approve/send,
  context assembly, session/POV, person-scoped brains, tests.
- **M2** ✅ Assistant surface — persistent ✨ assistant with proactive suggestions
  and an activity feed; Photos multi-select share.
- **M3** ✅ Multiple people + contacts graph — six residents with their own themed
  phones; **POV switcher** to embody any of them; a **Messages** inbox where
  shares actually arrive (threads + photo thumbnails) and a **Contacts** app for
  the derived people graph.
- **M4** ✅ Scenarios — `world/scenarios/*.md` script a sequence of `clock`/
  `focus`/`share` steps; a pure step runner + **ScenarioBar** play them, hopping
  the phone frame between actors and firing the same `propose`/`commit` calls a
  human tap would.
- **Assistant chat (pre-M5)** ✅ An open-ended **Ask** box on the assistant
  sheet, backed by a new `respond()` brain method — the exact context/reply
  harness a real model will plug into, still mock/deterministic for now.
- **M5** ✅ Real LLM provider (Gemini) behind the intelligence interface —
  now the project's primary target; the mock remains the offline/test
  fallback.
- **Task System (in stages, pre-M6)** 🚧 Implementing
  [`TASK_SYSTEM.md`](./TASK_SYSTEM.md). **Stage 1** ✅ confidence-ranked input
  resolution — the assistant confirms a low-confidence guess (a pre-filled
  "Share with …?" chip) instead of silently acting, binds a confident one, and
  asks outright when it has nothing to go on.
- **M6** More device shells (watch, glasses, appliances) + generated visuals.
