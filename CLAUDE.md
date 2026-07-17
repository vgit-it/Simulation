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
2. **Authored seed vs runtime state.** `world/` is the read-only seed. Everything
   mutable (messages sent, facts tracked, the clock) lives in the **event log**
   (`src/state/`) and is derived by reducer. Never mutate the seed at runtime;
   change the world by dispatching an event, and read runtime data via selectors.
3. **Everything smart goes through the intelligence adapter.** Any derived /
   "smart" result the UI shows must come from a person's brain
   (`intelligenceFor(personId)`, `src/intelligence/`). Never hardcode a smart
   result in a component, and never call an LLM directly from a component.
4. **All actions go through the pipeline.** User/assistant/scenario actions use
   `propose(intent, ctx, …) → Proposal → commit(proposal, dispatch)`
   (`src/actions/`). Don't dispatch effect events straight from a component;
   build a proposal so the same path serves the assistant and scenarios.
5. **Deterministic by default.** Read time from the store clock (`useNow` /
   `selectNow`), never `Date.now()`. `SIM_START` (`src/config.ts`) is only the
   initial value. The world must behave identically whenever it runs.
6. **Modular & additive.** Adding an app, theme, person, or device should be
   drop-a-file (+ at most one registry line). Prefer registries and data over
   conditionals.
7. **Validate loudly.** All authored content is schema-checked (`zod`) and
   cross-references are integrity-checked on load. Malformed content must fail
   with the file path and the exact problem, not silently mis-render.
8. **No tokens unless asked.** The default provider is `mock`. Do not wire real
   LLM calls unless the task explicitly calls for it; the mock must always remain
   a working, offline provider.

## Tech stack

- **React 18 + TypeScript + Vite** (static build for GitHub Pages).
- **Tailwind CSS** with theme tokens exposed as CSS variables.
- **Motion**: Tailwind keyframes/transitions + a tiny `useMountTransition`
  presence hook (`src/ui`) — no animation library. Motion is *engine-level*
  (uniform OS behavior in `tailwind.config.ts`); per-person identity stays in
  theme tokens. All animation is presentation-only (timeouts never feed sim
  state) and collapses under `prefers-reduced-motion`.
- **Inter** is self-hosted via `@fontsource-variable/inter` (bundled at build
  time — no runtime network, works offline).
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
npm run test       # vitest (reducer, brain, integrity)
npm run typecheck  # types only
```

## Repository layout

```
world/                         # CONTENT — authored, no code
  apps/<app>.md                # app definitions: photos, messages, contacts
  people/<person>/             # six residents (ava, sam, maya, leo, nadia, theo)
    profile.md                 # id, name, avatar, traits, behaviors
    contacts.md                # (optional; contacts are now derived — see below)
    devices/<device>.md        # type, name, theme, installed apps[]
    files/
      gallery/<id>.svg         # placeholder image
      gallery/<id>.yaml        # metadata sidecar: date, location, people[], tags[]
      documents/               # (reserved)
  themes/<theme>.md            # visual identity tokens; one per resident
  scenarios/<scenario>.md      # scripted step sequences (clock/focus/share) — played by ScenarioBar
src/
  config.ts                    # SIM_START, HERO_PERSON/DEVICE, provider choice
  world/                       # loaders + zod schemas -> typed seed World + selectors
    frontmatter.ts             # browser-safe frontmatter/YAML parsing
    schema.ts                  # zod schemas + inferred types
    loader.ts                  # import.meta.glob discovery + integrity check -> World
    index.ts                   # World selectors (getPerson/resolvePerson/contactsOf/resolveAsset/getScenario/...)
  state/                       # runtime state: event log, reducer, store (mutable)
    events.ts                  # SimEvent union (MessageSent, FactRecorded, ClockSet, ...)
    reducer.ts                 # apply/reduce/hydrate + RuntimeState
    selectors.ts               # selectNow, messagesFrom/Involving, inboxThreads, ...
    persistence.ts             # localStorage load/save/clear of the log
    store.tsx                  # StoreProvider, useStore, useNow
  session/                     # POV: which person+device is embodied + person/device switch
  intelligence/                # IntelligenceProvider.for(personId) -> person brain
    types.ts                   # the adapter contract (PersonIntelligence)
    mock.ts                    # deterministic implementation
    index.ts                   # provider selection + intelligenceFor(personId)
  context/                     # assembleContext(session, state, situation) -> bundle
  actions/                     # propose/commit pipeline + ProposalSheet UI
  assistant/                   # persistent assistant: suggestions + activity feed
  scenarios/                   # scenario playback: pure step runner + ScenarioBar UI
    runner.ts                  # resolveStep(step, state) -> events/focus/screen (pure)
    ScenarioBar.tsx             # out-of-phone player: pick/step/play a scenario
  ui/                          # shared primitives (Sheet, AppHeader, PillButton,
                               #   Avatar, EmptyState) + motion (useMountTransition)
  theme/                       # theme tokens -> CSS variables
  phone/                       # DeviceFrame (+ overlay slot), StatusBar, Lock/Home, Phone, DevBar
    Phone.tsx                  # takes screen/onScreenChange as controlled props (lifted to Stage)
  apps/                        # app registry + app renderers
    registry.ts                # appId -> React renderer
    types.ts                   # AppScreenProps
    photos/                    # the Photos app (gallery + detail + share)
    messages/                  # inbox of threads (MessagesApp) + Thread view
    contacts/                  # read-only derived contacts graph (ContactsApp)
  App.tsx                      # providers + Stage (owns screen state, mounts Phone/DevBar/ScenarioBar)
  main.tsx                     # React entry
.github/workflows/deploy.yml   # build + deploy to GitHub Pages on push to main
```

### Data flow

`world/` files → validated loader (`src/world`) → typed **seed** `World`.
`src/state` holds the **runtime** state (event log → derived state). The phone
shell (`src/phone`) reads the embodied POV from `src/session`, renders apps, and
apps ask the person's **brain** (`src/intelligence`) for derived results and the
**action pipeline** (`src/actions`) to propose/commit effects, which dispatch
events back into the store.

## How to extend (recipes)

**Add a photo:** drop `img-00N.svg` + `img-00N.yaml` into a person's
`files/gallery/`. It appears automatically (loader joins them by basename).

**Restyle a device:** edit the tokens in the device's theme file
(`world/themes/*.md`). No code changes.

**Add a person:** create `world/people/<id>/profile.md` (+ `devices/`, `files/`).
Ids are kebab-case and must match the folder name. Give them a device
(`devices/phone.md` with a `theme` + `apps:`) so they're embodiable via the POV
switcher (dev bar). Their **contacts appear automatically** from the photo graph
(see below) — put them in a photo with someone and the connection exists both
ways.

**Add a device to a person:** add `world/people/<id>/devices/<device>.md` with a
`theme` and an `apps: [...]` list.

**Contacts are derived, not authored:** `contactsOf(personId)` (`src/world`)
returns every real person that co-appears in that person's gallery. There is no
per-person contact list to maintain — the graph is a fact of the content. (An
authored `contacts.md` is still supported as a fallback label source for ids
that aren't real people, but the seed doesn't rely on it.)

**Add a new app:**
1. Author `world/apps/<app>.md` (frontmatter: `id`, `name`, `icon`, `category`,
   `capabilities`, `actions`).
2. Create a renderer under `src/apps/<app>/` implementing `AppScreenProps`
   (`src/apps/types.ts`). Build its surfaces from the `src/ui` primitives
   (`AppHeader`, `PillButton`, `Avatar`, `EmptyState`, `Sheet`) so motion and
   polish stay consistent across apps.
3. Register it in `src/apps/registry.ts` (one line).
4. Add the app id to a device's `apps:` list so it appears on the home screen.

**Add intelligence:** extend the `PersonIntelligence` interface
(`src/intelligence/types.ts`), implement it in the mock brain
(`src/intelligence/mock.ts`), and call it via `intelligenceFor(personId)`. Never
bypass the interface.

**Add an action/intent:** add an event to `SimEvent` (`src/state/events.ts`) +
handle it in the reducer if it changes derived state; add a `propose<Intent>`
builder and a `case` in `propose()` (`src/actions/index.ts`); render its
`Proposal` (reuse `ProposalSheet`) and call `commit` on confirm. This one path
powers both the assistant and scenarios.

**Add an assistant suggestion:** extend `suggestShares` (or a sibling method) on
the brain (`src/intelligence/mock.ts`) to return `Suggestion`s; the assistant
(`src/assistant/Assistant.tsx`) renders them and turns a tap into
`propose(intent, ctx, …)`. Suggestions are proactive pre-proposals, nothing more.

**Show received messages:** the event log is global, so a person's inbox is just
a filter over it — `messagesInvolving(state, personId)` and `inboxThreads(state,
personId)` (`src/state/selectors.ts`). Nothing needs to "deliver" a message to a
recipient; embody them (POV switch) and the Messages app folds the same log from
their point of view. Attachments render via `resolveAsset(senderId, assetId)`.

**Read/track runtime data:** read via selectors (`src/state/selectors.ts`) and a
`useStore()`/`useNow()` hook; write only by dispatching a `SimEvent`. The event
log is persisted automatically, so anything you record survives reloads.

**Add a scenario:** author `world/scenarios/<id>.md` with `id`, `name`,
`description`, and a `steps:` list of `clock` (advance the sim clock), `focus`
(cut to a person's phone on `locked`/`home`/`{app: <id>}`), or `share` (script
a `propose('share-photos', ctx, photos)` → `commit` for that person's own
gallery photos). It appears in the `ScenarioBar` picker automatically — no code.
`resolveStep(step, state)` (`src/scenarios/runner.ts`) is the pure function
turning one step into events + where to focus; `ScenarioBar` dispatches them
and drives `session.setPerson`/`setDevice` + the lifted `Phone` screen, the
same levers `DevBar` exposes to a human.

## Content conventions

- **Ids** are kebab-case and stable (they are referenced across files, e.g. a
  photo's `people:` list references person/contact ids).
- **Dates** are ISO (`YYYY-MM-DD`) and interpreted against the sim clock (starts
  at `SIM_START`).
- **Frontmatter** is fenced with `---` and must satisfy the matching schema in
  `src/world/schema.ts`. If you add a field, add it to the schema too.
- A photo's image and metadata share a basename (`img-001.svg` ↔
  `img-001.yaml`); a metadata file with no matching image is a hard error.

## Verification (before committing non-trivial changes)

1. `npm run test` and `npm run build` both pass (unit tests + typecheck + build).
2. Drive the real flow (browser or headless Playwright): **lock → unlock → home
   → open the app → interact** (e.g. Photos → open a photo → Share → Send).
   Confirm no console errors, and that persisted effects survive a reload and
   clear on **Reset world**.
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

### M1 — Phone shell + Photos ✅

Interactive phone (lock → home → app), one seed person (Ava), and the **Photos**
app: a time-grouped gallery whose grouping and "people in photo" come from the
mock intelligence + metadata. Themeable, content-driven, deployable.

### M1.5 — Foundation ✅

The architectural spine that makes the later milestones cheap:
- **Runtime state** = event log + reducer + selectors (`src/state`), persisted to
  localStorage; authored `world/` stays read-only seed.
- **Action/intent pipeline** (`src/actions`): `propose → Proposal → commit`, with
  a minimal `ProposalSheet` approve/send surface. Photos' **Share** is wired
  through it end-to-end (drafts recipients from metadata, sends, persists,
  shows a "shared with" indicator).
- **Context assembly** (`src/context`): `assembleContext → ContextBundle`, the
  bundle an LLM decider will consume in M5.
- **Session/POV** (`src/session`): the embodied hero person + device switcher.
- **Person-scoped brains**: `intelligenceFor(personId)` (shared across a person's
  devices), replacing the global singleton.
- **Clock** routed through the store (`useNow`); load-time **integrity check**;
  **vitest** harness; **dev bar** (sim time / device switch / reset).

### M2 — Assistant surface ✅

A persistent assistant (floating ✨, pinned via the `DeviceFrame` overlay slot,
available from any unlocked screen). It offers proactive **suggestions** from the
brain (`suggestShares` — e.g. "share this week's photos with the people in
them"); one tap turns a suggestion into a `Proposal` you approve. It also shows a
running **activity feed** of sent items (read from the persisted event log).
Photos gained a **multi-select** mode that shares many photos in one proposal.
All built on the M1.5 pipeline — new UI + one brain method, no new plumbing.

### M3 — Multiple people + contacts graph ✅

A multi-person world: six residents (Ava + Sam, Maya, Leo, plus new residents
Nadia and Theo), each a full person with their own themed phone and gallery.
Photo `people:` resolve to **real people** in the world, and a person's
**contacts are derived** from that graph (`contactsOf` — everyone you co-appear
with), not an authored list. The **POV switcher** (dev bar) embodies any
resident — "picking up their phone" (re-themes + starts locked). Two new
content-driven apps close the loop from M2:
- **Messages** (`src/apps/messages`): an inbox of threads derived from the
  global event log (`inboxThreads`), so a share Ava sends **arrives** in the
  recipient's inbox the moment you embody them — thread view renders the message
  and photo thumbnails (resolved from the sender's gallery via `resolveAsset`).
- **Contacts** (`src/apps/contacts`): a read-only view of the derived people
  graph with shared-photo counts.

All on the M1.5 substrate — new content + two app renderers + a few pure
selectors (`messagesInvolving`, `inboxThreads`, `contactsOf`), no new plumbing.
Deferred: replying from the inbox, message-based (runtime) contacts, global
asset ids (Photo→Asset), unread badges (needs a `ThreadRead` event + reducer
semantics), a global toast surface (the `DeviceFrame` overlay slot is the
seam), per-theme motion tokens. (Scenarios landed as M4.)

### M4 — Scenarios ✅

`world/scenarios/*.md` are authored, schema-validated content (same flat-file
pattern as apps/themes): an `id`/`name`/`description` plus a `steps:` list of
three kinds — `clock` (advance the sim clock), `focus` (cut to a person's phone
on a given screen), and `share` (script a real `propose('share-photos', ctx,
photos)` → `commit` call). `resolveStep(step, state)` (`src/scenarios/
runner.ts`) is a pure function turning one step into `{ events, focus?,
screen? }`; the `ScenarioBar` (out-of-phone chrome beside `DevBar`) picks a
scenario, then Steps/Plays through it by dispatching those events and driving
`session.setPerson`/`setDevice` — the exact same imperative levers `DevBar`
already exposed to a human, just sequenced by a script.

The one new mechanism: `Phone`'s lock/home/app screen was lifted out of local
`useState` into controlled props (`screen`/`onScreenChange`), now owned by a
`Stage` component in `App.tsx`, so a scenario can "tap" through a screen
without a human clicking — `Phone` itself is unchanged behaviorally, it just
re-renders off props instead of internal state. The player shows **one phone
frame that hops between actors** per step (not simultaneous multi-device
panes) — the cheapest option, since it needs no decoupling of `Phone` from the
global `session`.

All on the M1.5/M3 substrate — one new content type, one pure step-resolver, one
UI component, no new event types (`ClockSet` already existed, unused until now).
Deferred: simultaneous multi-device visualization, branching/conditional
scenarios, step kinds beyond clock/focus/share (e.g. a `message`/reply step
once M3's "reply from inbox" lands).

### Assistant chat — mock-backed harness ✅ (current, pre-M5)

The Assistant sheet gained a third section, **Ask**: a free-form text box next
to Suggestions/Recent activity. `PersonIntelligence` gained one method,
`respond(ctx: ContextBundle, history: ChatTurn[], message: string):
ChatReply` (`src/intelligence/types.ts`) — the mock implementation
(`src/intelligence/mock.ts`) is deterministic keyword rules (share/photo
keywords reuse `suggestShares`; a contact's name reports `sharedPhotoCount`;
anything else gets a scripted fallback that's honest about not being a real
model yet). `Assistant.tsx` calls it exactly like `onSuggestion` calls
`draftShare` — `assembleContext` → `intelligenceFor(personId).respond(...)` —
no new plumbing.

This exists because `ContextBundle`'s own doc comment already called it out —
*"the bundle an LLM decider would receive later"* — so this **is** the
harness M5 plugs a real model into; today `respond()` is a pure function
over already-known world/state data, not a network call. Note on M5's key
strategy below: a Claude.ai subscription **cannot** back this — Anthropic's
Agent SDK docs are explicit that third-party products may not authenticate
via claude.ai login/subscription rate limits, only an API key. Deferred:
wiring a real model behind `LLMIntelligence.respond` (needs the key +
proxy-hosting decisions below), persisting chat history to the event log,
letting a reply spawn a `Proposal` the way suggestions do.

### M5 — Real LLM provider

Implement `LLMIntelligence` behind the existing `IntelligenceProvider` interface
and select it via config. Decide the key strategy at that point (client-side key
vs. serverless proxy) — GitHub Pages is static-only, so a real backend requires a
serverless function. A Claude.ai Pro/Max subscription is not a valid backend for
this (see above) — it must be a real Anthropic API key, held server-side.
Keep the mock as the default/offline provider.

### M6 — More device shells & richer visuals

Watch / glasses / appliance frames reusing the app + theme registries; optional
image generation for scenario output.

## Things to keep in mind for future work

- The style/visual identity is meant to be author-defined via theme tokens and
  (later) style guides — keep visual decisions in `world/themes/` and
  `src/theme/`, not scattered in components.
- When adding LLM calls (M5), preserve determinism as an option: the mock must
  remain a working, token-free provider so the world is always runnable offline.
- **Deferred foundation seams** (noted so we build toward them, not around them):
  generalize `Photo` → a shared `Asset` shape (documents/avatars/wallpapers/
  generated images) before M6 image generation; expand the theme schema toward a
  full design-token set (typography/spacing/wallpaper) when the style-guide work
  lands. Neither is built yet — don't over-invest early, but don't block them.
- Keep new effects expressible as `SimEvent`s so scenarios can script them the
  same way `share` steps script `propose`/`commit` today — a scenario step
  should never need a parallel effect path from the one a human interaction
  uses.
- Prefer extending schemas and registries over adding conditionals; the codebase
  should stay "add a file, it shows up."
