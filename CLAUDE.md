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
- **Design system**: the OS look (type scale, spacing, shape) is authored
  content in `world/design/DESIGN.md` — [DESIGN.md format](https://github.com/google-labs-code/design.md)
  (YAML tokens + prose philosophy), following Google Sans typography
  principles. Tokens flow file → zod schema → CSS variables → utilities
  (`.type-*` role classes in `src/index.css`; `space-*`/`ds-*`
  spacing/radius keys in `tailwind.config.ts`). Editing the file restyles the
  OS; per-person identity (colors) stays in `world/themes/*.md`.
- **Fonts** are self-hosted via `@fontsource-variable/*` (bundled at build
  time — no runtime network, works offline): **Figtree** as the brand/display
  face (an open stand-in for the proprietary Google Sans) and **Inter** as the
  plain text face.
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
  apps/<app>.md                # app definitions: photos, messages, contacts, reminders, assistant
  people/<person>/             # six residents (ava, sam, maya, leo, nadia, theo)
    profile.md                 # id, name, avatar, traits, behaviors
    contacts.md                # (optional; contacts are now derived — see below)
    devices/<device>.md        # type, name, theme, installed apps[]
    files/
      gallery/<id>.svg         # placeholder image
      gallery/<id>.yaml        # metadata sidecar: date, location, people[], tags[]
      documents/               # (reserved)
  design/DESIGN.md             # the OS design language: type scale, spacing, shape + philosophy
  themes/<theme>.md            # per-person visual identity tokens; one per resident
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
    trace.ts                   # research overlay: wall-clock + tap trace per event; session export
    store.tsx                  # StoreProvider, useStore, useNow
  session/                     # POV: embodied person+device + the live on-screen Selection
  intelligence/                # IntelligenceProvider.for(personId) -> person brain
    types.ts                   # the adapter contract (PersonIntelligence)
    mock.ts                    # deterministic implementation
    llm/prompt.ts              # buildLLMRequest: ContextBundle -> exact Anthropic API payload
    llm/index.ts               # LLMIntelligence (dry-run today): shows the payload, no network
    index.ts                   # provider selection (config + DevBar override) + intelligenceFor(personId)
  context/                     # assembleContext(session, state, situation) -> bundle
  actions/                     # propose/commit pipeline + ProposalSheet UI
    capabilities.ts            # capability registry: app actions: frontmatter -> propose impls
  assistant/                   # persistent assistant: suggestions + threaded chat + activity feed
    control.tsx                # AssistantControlProvider: sheet open/close + the bound conversation thread
  autopilot/                   # resident behaviors: dueAutopilotActions + useAutopilot (world acts back)
  plans/                       # runtime plans: brain-generated cross-app step sequences
    types.ts                   # Plan + PlanStep (navigate/gather vs action steps)
    executor.ts                # resolvePlanStep + shared step primitives (also used by scenarios)
    usePlanRunner.tsx          # drives a plan through the phone (POV + lifted screen), pausing on action steps
    PlanSheet.tsx              # plan preview: approve the decomposition before it runs
    PlanProgress.tsx           # live execution HUD (checklist, current step)
  scenarios/                   # scenario playback: pure step runner + ScenarioBar UI
    runner.ts                  # resolveStep(step, state) -> events/focus/screen (reuses plans/executor primitives)
    ScenarioBar.tsx             # out-of-phone player: pick/step/play a scenario
  ui/                          # shared primitives (Sheet, AppHeader, PillButton,
                               #   Avatar, EmptyState) + motion (useMountTransition)
  theme/                       # design-system + theme tokens -> CSS variables
  phone/                       # DeviceFrame (+ overlay slot), StatusBar, Lock/Home, Phone, DevBar
    Phone.tsx                  # takes screen/onScreenChange as controlled props (lifted to Stage)
    screen.tsx                 # ScreenProvider/useScreenControl: shares the lifted screen with the in-phone assistant
  apps/                        # app registry + app renderers
    registry.ts                # appId -> React renderer
    types.ts                   # AppScreenProps
    photos/                    # the Photos app (gallery + detail + share)
    messages/                  # inbox of threads (MessagesApp) + Thread view w/ reply composer
    contacts/                  # derived contacts graph; tap to select a person (ContactsApp)
    reminders/                 # to-dos from ReminderCreated events + direct add (RemindersApp)
    assistant/                 # conversation threads with the assistant; tap to resume one (AssistantApp)
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

**Restyle the OS (every device):** edit `world/design/DESIGN.md` — type roles
(display/headline/title/body/body-sm/label/caption), font stacks, the spacing
scale, or the shape scale. Every value is schema-checked and flows to the UI
as CSS variables; the prose sections document the philosophy behind the
numbers. No code changes. (Role/scale *names* are the engine contract — adding
a new role means also adding it to `src/world/schema.ts` and a `.type-*` class
in `src/index.css`.)

**Restyle a device:** edit the tokens in the device's theme file
(`world/themes/*.md`). Themes are the per-person layer (colors, radii, base
font) over the shared OS design language. No code changes.

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

**Add an action/intent:** declare it in the owning app's `actions:` frontmatter
(`world/apps/<app>.md` — id, label, and an optional `selection: {kind, min}`
saying what must be selected for it to apply), then register a matching
`propose` implementation in `src/actions/capabilities.ts` (one entry in
`implementations`). A propose impl receives `(ctx, ids, payload?)` — `ids` are
the object ids acted on, `payload` carries free-form inputs (message text, a
reminder title) drafted by the brain or typed by the user; a `Proposal` that
can't commit sets `invalidReason` (and may override the confirm button via
`confirmLabel`). Supply an `amend(edit)` that re-calls the impl with payload
overrides so the proposal is user-editable in the sheet (message text,
removable recipients) — the edit re-derives the events, keeping what's shown
identical to what commits. The registry is built by joining the two at load and fails
loudly on any mismatch (declared-but-unimplemented or implemented-but-
undeclared). Add an event to `SimEvent` (`src/state/events.ts`) + reducer
handling if it changes derived state; render its `Proposal` (reuse
`ProposalSheet`) and call `commit` on confirm. This one path powers the
assistant, scenarios, and (next) runtime plans. `viableCapabilities(ctx)` is
the decider-facing view: the capabilities usable right now, filtered by the
embodied device's installed apps and the current selection.

**Expose a user selection to the assistant:** apps write what the user has
picked to the session (`setSelection({ app, kind, ids })`, `src/session`);
`assembleContext` folds it into `ContextBundle.situation.selection`
automatically, so any decider sees "what's selected" without callers plumbing
ids. Selection clears on person/device switch and when the app unmounts; pass
an explicit `selection: null` in a `Situation` to override it for one call.
Current selection kinds: `photos` (Photos multi-select) and `people` (an open
thread's participants in Messages; a tapped contact in Contacts) — the kind is
what capability `selection:` specs match against, so where it was selected
doesn't matter.

**Add an assistant suggestion:** extend `suggest(ctx)` on the brain
(`src/intelligence/mock.ts`) to return `Suggestion`s — a suggestion carries
exactly the propose inputs (`intent`, `ids`, optional `payload`, an `icon`),
so the assistant (`src/assistant/Assistant.tsx`) turns a tap into
`propose(intent, ctx, ids, payload)` for ANY intent. Suggestions are proactive
pre-proposals, nothing more — and they're situated: read `ctx.state` so the
suggestion disappears once the log shows it happened (see `sharedPhotoIds` /
`unansweredInboundShare` for the pattern).

**Show received messages:** the event log is global, so a person's inbox is just
a filter over it — `messagesInvolving(state, personId)` and `inboxThreads(state,
personId)` (`src/state/selectors.ts`). Nothing needs to "deliver" a message to a
recipient; embody them (POV switch) and the Messages app folds the same log from
their point of view. Attachments render via `resolveAsset(senderId, assetId)`.

**Read/track runtime data:** read via selectors (`src/state/selectors.ts`) and a
`useStore()`/`useNow()` hook; write only by dispatching a `SimEvent`. The event
log is persisted automatically, so anything you record survives reloads.

**Export a study session:** the DevBar's **⬇ Export** downloads the session as
JSON — the full event log plus its **trace** (`src/state/trace.ts`): one
`{seq, type, simAt, wallAt, taps}` entry per dispatched event, stamping
wall-clock time and the cumulative in-phone tap count (a capture-phase pointer
listener on the `DeviceFrame` screen; out-of-phone chrome doesn't count). The
sim log stays purely sim-clocked — `trace.ts` is the ONE module allowed
`Date.now()`, because it measures the human, not the sim. From the export an
analyst computes taps/seconds between any two log points, e.g. manual-path vs
assistant-path for the same task. The trace persists beside the log and clears
on **Reset world**.

**Add a scenario:** author `world/scenarios/<id>.md` with `id`, `name`,
`description`, and a `steps:` list of `clock` (advance the sim clock), `focus`
(cut to a person's phone on `locked`/`home`/`{app: <id>}`), `share` (script
a `propose('share-photos', …)` → `commit` for that person's own gallery
photos), or `message` (script `propose('send-message', …)` — a person texts
`to:` recipients `text:`). It appears in the `ScenarioBar` picker
automatically — no code. `resolveStep(step, state)`
(`src/scenarios/runner.ts`) is the pure function turning one step into events +
where to focus; `ScenarioBar` dispatches them and drives
`session.setPerson`/`setDevice` + the lifted `Phone` screen, the same levers
`DevBar` exposes to a human. Clock steps can wake resident autopilot (below) —
time passing IS a world event.

**Give a resident autopilot:** add `auto-reply: { delay-hours: N, message:
"…" }` under `behaviors:` in their profile (`world/people/<id>/profile.md`).
While they are NOT embodied, any inbound share to them draws that reply N sim
hours after the share — dispatched by `useAutopilot` (`src/autopilot`), which
resolves due behaviors (`dueAutopilotActions`, pure + tested) through the same
`send-message` capability a human reply uses, re-stamped to the due time.
Embodying a person suspends their autopilot ("you picked up their phone").
Replies only trigger on messages with attachments, so two auto-repliers can't
ping-pong forever.

**Unread badges:** opening a thread dispatches `ThreadRead`; `unreadThreadKeys`
/ `unreadCountFor` (`src/state/selectors.ts`) derive what's unread (newest
message inbound + newer than your last read). The Messages home-icon badge and
inbox dots read these — an autopilot reply while you're elsewhere badges the
icon, exactly like a real phone.

**How runtime plans work (no authoring needed):** a plan is a scenario the
brain writes on the fly. `brain.plan(ctx, request)`
(`src/intelligence/mock.ts`) decomposes a free-form request into an ordered
`Plan` of `PlanStep`s over the **capability registry** — navigate/gather steps
(open an app so the user sees the context) and action steps (an `intent` + object
`ids` that build a `Proposal` when reached). `respond()` returns a plan for an
imperative request (advisory questions still get suggestions). `usePlanRunner`
(`src/plans`) executes it through the **same levers** scenarios use —
`resolvePlanStep` produces `{events, focus, screen, proposal?}`, sharing its
primitives with `scenarios/runner.ts` — driving the phone app-by-app; action
steps pause at a `ProposalSheet` for approval, navigate steps auto-advance.
`PlanSheet` previews the decomposition first; `PlanProgress` narrates it live;
`PlanStarted`/`PlanCompleted` events persist each run (`plansFor` selector). The
assistant reaches the lifted phone screen via `useScreenControl`
(`src/phone/screen.tsx`). Adding a capability (see "Add an action/intent") widens
what plans can contain — no plan-engine edits.

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

### Agent harness I — selection + capability registry ✅ (current, pre-M5)

The first two pieces of the "select things, then tell the assistant what to do"
loop, building toward runtime plans:

- **Selection is session state** (`Selection { app, kind, ids }`,
  `src/session`): apps write what the user has picked (Photos' multi-select is
  wired), `assembleContext` folds it into `situation.selection`, and it clears
  on person/device switch or app close. This is the bridge from a direct
  manipulation ("tap three photos") to an assistant command ("share *these*").
- **The capability registry** (`src/actions/capabilities.ts`): app `actions:`
  frontmatter is now machine-read, not documentation. Each declared action
  (id, label, `selection: {kind, min}` requirement) is joined with a `propose`
  implementation at load — mismatches throw with the file path.
  `propose()` routes through it (the old switch is gone), and
  `viableCapabilities(ctx)` enumerates what's usable right now (app installed
  on the embodied device + selection satisfied) — the action space a decider
  chooses from.

### Agent harness II — runtime plans ✅ (current, pre-M5)

The other half of the loop: the assistant now **plans and executes** a
free-form request across apps, showing every step.

- **`brain.plan(ctx, request)`** (`src/intelligence`): decomposes a request into
  an ordered `Plan` of `PlanStep`s over the capability registry — navigate/gather
  steps and action steps (an `intent` + object `ids`). It binds to the current
  selection ("share *these*") or falls back to this week's shareable photos.
  `ChatReply` gained `plan?`; `respond()` returns a plan for imperative requests,
  suggestions for advisory questions.
- **One execution path** (`src/plans/executor.ts`): `resolvePlanStep` and the
  scenario `resolveStep` share their step primitives (`focusScreen`,
  `appOpenedEvent`, the `propose`/`commit` capability path), so a planned step
  and a scripted step take the exact same road. `usePlanRunner` drives the phone
  through a plan using the same POV + lifted-screen levers `DevBar`/`ScenarioBar`
  use — reached from the in-phone assistant via `useScreenControl`
  (`src/phone/screen.tsx`). Action steps pause at a `ProposalSheet` for approval;
  navigate steps auto-advance.
- **Visible + persistent**: `PlanSheet` previews the decomposition (approve
  before it runs), `PlanProgress` narrates it live (checklist + current step),
  and `PlanStarted`/`PlanCompleted` events record each run (`plansFor`), so the
  activity feed shows completed plans and they survive reload.

This is the harness M5's real model plugs into unchanged: the LLM brain returns
the same `Plan`/`ChatReply` shape (its tool/capability calls) and everything
downstream — preview, execution, approval, persistence — already works.
Deferred: `PlanStepCompleted` events (per-step persistence — landed in harness
VII), branching/conditional plans, an "auto-approve" supervision level that
commits action steps without pausing (landed in harness IV), plans that span
multiple people's devices.

### Agent harness III — capability breadth ✅ (current, pre-M5)

Roadmap stage ①: plans became genuinely cross-app by widening the capability
vocabulary — no plan-engine edits, exactly as designed.

- **`send-message`** (Messages): replying is live, closing the M3 deferral. The
  thread composer and the assistant's plan step share one capability — a human
  reply commits directly (you don't approve your own words); an assistant
  message pauses for approval. Propose impls gained a `payload` (free-form
  inputs: message text, reminder title), `Proposal` gained
  `invalidReason`/`confirmLabel`, and `propose()` is now ids+payload based.
- **Reminders** (new app + `create-reminder`): the first non-message effect.
  `ReminderCreated` events → derived `reminders` + `remindersFor`; reminders
  can reference photos (`related` ids render as thumbnails). No selection
  requirement — content arrives via payload.
- **`people` selections**: opening a thread selects its participants; tapping a
  contact selects that person. Capability specs match on selection *kind*, so
  "message *them*" binds from either app.
- **Composite plans**: `plan()` composes share/message/reminder steps from
  request keywords + the selection kind, gated per-step on installed apps.
  "Share these and remind me to print one" → a 4-step plan across 3 apps, with
  the reminder title extracted from the request; "share these and tell them…"
  chains the message to the share's recipients (and skips the redundant
  confirm hop).

### Agent harness IV — supervision & trust ✅ (current, pre-M5)

Roadmap stage ②: the trust dial. How closely you supervise a plan is now a
per-plan choice, and every drafted proposal is editable before it commits.

- **Supervision levels** (`Supervision`, `src/plans/types.ts`), picked at the
  `PlanSheet`: `confirm-each` (pause at every action's ProposalSheet — the
  default), `confirm-once` ("Watch it run": the Run tap is the one approval;
  actions auto-commit while the phone still walks app-by-app), and `auto`
  ("Just do it": every step commits back-to-back with no walkthrough — the
  receipt appears in the activity feed). An **invalid proposal always pauses**,
  whatever the level — autonomy never overrides a validity stop. The chosen
  level rides on `PlanStarted` and shows in the activity feed (telemetry for
  track ⑥).
- **Editable proposals**: `Proposal` gained `amend(edit) -> Proposal` — each
  capability re-derives its own display fields AND events from an edit, so
  what's on screen is exactly what commits. `ProposalSheet` renders the message
  as an editable textarea and recipients as removable chips; edits accumulate
  (payload overrides thread through re-proposal). Clearing required content
  flips the proposal invalid rather than resurrecting the draft.
- **Plan editing**: tap a step in the `PlanSheet` to strike it from the run
  (struck steps show crossed out; Run disables if no action step remains).

Deferred from track ②: interrupt-&-takeover (detect the user doing a paused
step manually and skip ahead).

### Agent harness V — situated brain ✅ (current, pre-M5)

Roadmap stage ③: the brain now reads the runtime log through the context, so
what it offers reflects what has actually happened.

- **`suggest(ctx)` replaces `suggestShares(photos, now)`**: suggestions are
  situated and intent-agnostic. `Suggestion` now carries exactly the propose
  inputs (`intent`, `ids`, `payload?`, `icon`), so a tap runs
  `propose(intent, ctx, ids, payload)` for any capability.
- **No re-suggesting**: photos whose ids appear in any message the person
  already sent drop out of share suggestions (`sharedPhotoIds`); once
  everything recent is shared, the suggestion disappears entirely (and
  `respond()` says so instead of re-offering).
- **Inbound reactions**: an unanswered inbound share surfaces "Reply to Sam —
  sent you 2 photos" with a drafted reply (`unansweredInboundShare`). Replying
  (at ≥ the share's sim timestamp — the clock may not have moved) retires it.
  Embody the recipient and the world has visibly acted on you.
- **`last-shared-with` is finally read**: an unbound "send a message" plan
  falls back to the most recent `last-shared-with` fact — the brain's recorded
  memory now shapes its plans.
- **Chat history is event-log state**: `ChatMessage` events → `chats` +
  `chatHistoryFor`; the Assistant dispatches each turn, so conversations
  survive reload/POV switches and feed `respond()` as real history.

### Agent harness VI — world dynamics ✅ (current, pre-M5)

Roadmap stage ④: a world that acts back, without you embodying it.

- **Resident autopilot** (`src/autopilot`): profiles' `behaviors:` field is
  finally read — a typed `auto-reply: {delay-hours, message}` behavior
  (schema'd in `src/world/schema.ts`; authored for Sam 2h / Maya 4h). The pure
  `dueAutopilotActions(state, embodiedId)` resolves due replies through the
  same `send-message` capability humans use, re-stamped to the due sim time;
  `useAutopilot` (mounted in Stage) dispatches whatever's due each time state
  changes, and its idempotence is the loop guard. The embodied person never
  autopilots; only attachment-bearing messages trigger replies (no ping-pong).
- **Unread badges** (deferred since M3): `ThreadRead` events + `reads` fold +
  `unreadThreadKeys`/`unreadCountFor`; the Messages icon badges on home, unread
  threads show a dot + bold, opening a thread (or receiving while it's open)
  marks it read.
- **`message` scenario step**: scenarios can script a text
  (`kind: message, person, to, text`) through the send-message capability. The
  authored `evening-catchup` scenario shows the whole stage: Ava shares, a
  `clock` step wakes Sam's autopilot (no step sends his reply!), Maya's
  check-in is a `message` step, and Ava returns to a badged inbox.
- **DevBar `+1h`**: advance the sim clock by an hour — time passing is now an
  interesting act, since residents may respond to it.

### Roadmap — enhancement tracks (post-harness II)

Six tracks, ordered by leverage. Tracks 1–4 and 6 are staged below; track 5 is
M5 and track "shells" is M6. Each stage is one PR-sized change.

1. **Capability breadth** — make plans genuinely cross-app. `send-message`
   (reply from the inbox, closing the M3 deferral), a **Reminders** app with
   `create-reminder` (the cheapest genuinely-different effect), and new
   selection kinds (a thread or contact, not just photos) so "message *this*
   group" can bind. Plans get composite: "share these with Maya and remind me
   to print one" spans three apps.
2. **Supervision & trust** — the heart of the research question. Per-plan
   supervision levels at the `PlanSheet` (confirm each action / confirm once /
   just do it), **editable proposals** (tweak recipients/message before Send),
   plan editing (strike a step before running), and interrupt-&-takeover
   (detect the user doing a paused step manually — the step's event is already
   in the log — and skip ahead).
3. **Context depth** — a situated brain. Use the facts it already records
   (`last-shared-with` is written and never read; don't re-suggest
   already-shared photos via `messagesWithAttachment`), persist chat history as
   events, and react to **inbound** shares ("Sam sent 2 photos; reply?").
4. **World dynamics** — a world that acts back. Resident autopilot behaviors
   (profiles' parsed-but-unread `behaviors:` field; e.g. Sam replies +2h sim
   time after a share), unread badges (`ThreadRead` event, deferred since M3),
   and a `message` scenario step kind.
5. **M5 — real LLM brain** (below), plus an **evaluation harness**: fixtures of
   (world state, selection, request) → expected plan, with the mock as oracle,
   so LLM decomposition quality is measured, not eyeballed.
6. **Research instrumentation** — turn the prototype into an instrument. The
   event log is the telemetry substrate: record plan proposed/edited/approved/
   cancelled + per-step timing, compare manual-path vs assistant-path for the
   same task (taps, seconds), add a session-export. Fold in alongside the first
   real user-drive session.

**Staged sequence:** ① capability breadth (Reminders + `send-message` + new
selection kinds) ✅ (landed as harness III) → ② supervision levels + editable
proposals ✅ (landed as harness IV) → ③ situated
brain ✅ (landed as harness V) → ④ resident autopilot ✅ (landed as harness
VI) → ⑥ research instrumentation ✅ (landed as harness VII) → ⑤ M5 LLM +
eval fixtures. Rationale: supervision is
only interesting once plans have multiple real actions to supervise; the LLM
goes late because every earlier track makes its job better-defined while the
swap stays cheap by design; instrumentation landed just before the LLM so the
first real-model sessions are measured from day one.

### M5 groundwork — LLM dry-run harness ✅

Everything except the network call. `LLMIntelligence`
(`src/intelligence/llm/`) implements `PersonIntelligence` behind the existing
provider seam, selected via config or the DevBar **Brain** toggle (🧪 mock /
🔌 llm dry-run, persisted per-browser in localStorage). Its `respond()`
assembles the EXACT Anthropic Messages API request the real provider will
send — `buildLLMRequest(ctx, history, message)` (`llm/prompt.ts`) produces
`{model, max_tokens, system, tools, messages}`:

- **system**: the ContextBundle serialized — owner + traits, sim time, device
  + installed apps, open app, live selection, contacts, gallery metadata
  (ground truth), recent messages, reminders, recorded facts, recent plan
  runs, and the ChatReply/PlanStep JSON reply contract.
- **tools**: the capability registry (installed apps only), each with its
  selection requirement and whether the current selection satisfies it.
- **messages**: persisted chat history + the new turn.

Instead of calling, it returns the payload on `ChatReply.llmRequest`; the
Assistant renders it (model, system, tools, messages) so you can inspect
precisely what the model would see. Everything that isn't the decider seam
(grouping, drafts, suggestions, plans) delegates to the mock, so the phone
stays fully usable — and token-free — in dry-run mode. The mock remains the
default provider (principle 8).

### Agent harness VII — research instrumentation ✅ (pre-M5)

Roadmap track ⑥: the prototype is now an instrument. The event log is the
telemetry substrate; a parallel **trace** adds the human-side measurements.

- **Full plan lifecycle in the log**: `PlanProposed` (the PlanSheet was
  shown — recorded before any approval, so declined plans leave a trail),
  `PlanStepCompleted` per finished step (closing the harness-II deferral),
  `PlanStarted.struck` (steps the user edited out before running), and a
  `declined` outcome on `PlanCompleted` (dismissed at the preview, never run)
  next to `completed`/`cancelled`. `PlanRun` folds it all —
  `outcome: proposed|running|completed|cancelled|declined`, `struck`,
  `stepsDone` — and the activity feed shows struck counts and declined runs.
- **The trace** (`src/state/trace.ts`): the store's `dispatch` stamps every
  event with `{seq, type, simAt, wallAt, taps}` — wall-clock time plus the
  cumulative in-phone tap count (capture-phase pointer listener on the
  `DeviceFrame` screen). The sim log stays purely deterministic; the trace is
  the one sanctioned home for `Date.now()` (it measures the human, not the
  sim) and nothing in sim behavior reads it. Persisted beside the log; cleared
  by Reset world.
- **Session export**: DevBar **⬇ Export** downloads
  `{version, exportedAt, simClock, provider, taps, events, trace}` as JSON.
  Taps/seconds between any two log points — manual path vs assistant path for
  the same task — are computable offline from one file.

Deferred: an in-app comparison view (the analysis lives in the export for
now), per-proposal edit telemetry (which fields were amended), multi-session
aggregation.

### Assistant app — conversation threads ✅ (current, pre-M5)

Assistant conversations are now threads, and the phone has an **Assistant
app** listing them (installed on all six phones).

- **Each request is its own conversation**: `ChatMessage` events carry a
  `session` id. Invoking the assistant from anywhere OTHER than an existing
  thread — the FAB, or the app's **New** button — mints a fresh id
  (`AssistantControlProvider`, `src/assistant/control.tsx`), so the sheet
  opens on an empty conversation; an unused id leaves no trace (a thread only
  exists once a turn is dispatched with it). Turns recorded before threads
  existed collapse into one legacy conversation.
- **The Assistant app** (`src/apps/assistant/`) is a window onto the record:
  `chatSessionsFor` groups a person's turns into threads (title = first user
  message, preview = last turn, newest activity first — sim-time ties break
  by log order, since the clock may not move between asks). Tapping a thread
  **resumes** it: the sheet opens bound to that session, its history renders,
  and `respond()` receives it (the mock's greeting proves the seam: fresh
  threads greet, resumed ones don't). It declares no actions — chat, plans,
  and proposals all still live in the persistent assistant surface.
- The sheet's chat is session-scoped end-to-end: displayed turns, the history
  fed to the brain, and the dry-run `buildLLMRequest` messages all derive from
  `chatHistoryFor(state, person, session)`.

Deferred: cross-thread memory (each conversation is independent context for
the brain), thread deletion/renaming, surfacing plan runs inside the thread
that spawned them.

### M5 — Real LLM provider (remaining)

Swap the dry-run tail of `respond()` for the real call: send
`buildLLMRequest(...)`, parse the ChatReply/Plan JSON — nothing upstream
changes. Decide the key strategy at that point (client-side key vs. serverless
proxy) — GitHub Pages is static-only, so a real backend requires a serverless
function. A Claude.ai Pro/Max subscription is not a valid backend for this
(see above) — it must be a real Anthropic API key, held server-side. Add the
eval-fixture harness (roadmap ⑤) alongside: (state, selection, request) →
expected plan, mock as oracle. Keep the mock as the default/offline provider.

### M6 — More device shells & richer visuals

Watch / glasses / appliance frames reusing the app + theme registries; optional
image generation for scenario output.

## Things to keep in mind for future work

- The style/visual identity is author-defined: the shared OS language lives in
  `world/design/DESIGN.md`, per-person identity in `world/themes/*.md` — keep
  visual decisions in those files (flowing through `src/theme`), not scattered
  in components. New UI should use the `.type-*` role classes and
  `space-*`/`ds-*` tokens, never raw text-size/tracking/padding values.
- When adding LLM calls (M5), preserve determinism as an option: the mock must
  remain a working, token-free provider so the world is always runnable offline.
- **Deferred foundation seams** (noted so we build toward them, not around them):
  generalize `Photo` → a shared `Asset` shape (documents/avatars/wallpapers/
  generated images) before M6 image generation. (The design-token seam landed
  as `world/design/DESIGN.md` — typography/spacing/shape are OS-level tokens
  there; a remaining sub-seam is per-theme wallpaper and theme-level type
  overrides if a resident ever needs them.)
- Keep new effects expressible as `SimEvent`s so scenarios can script them the
  same way `share` steps script `propose`/`commit` today — a scenario step
  should never need a parallel effect path from the one a human interaction
  uses.
- Prefer extending schemas and registries over adding conditionals; the codebase
  should stay "add a file, it shows up."
