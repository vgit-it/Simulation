# Task System

> **Single source of truth for the Task System's concept and design.** This is a
> **living doc** — expand it as the system's complexity grows. Keep `CLAUDE.md`
> and `README.md` *pointing here*; do not duplicate the model in them.

**Status:** design / concept, now **landing in stages**. **Stages 1–2 are
implemented**: confidence-ranked input resolution + the medium confirm band
(`src/actions/requirements.ts`) and **elicit value-kind pickers + NL parse**
(`src/actions/valueKinds.ts`, `src/assistant/pickers/`), both surfaced in
`src/assistant/Assistant.tsx`. The rest below (the task stack, stakes, LLM-cost
caching) are still design. The engine's other precursors (capabilities, plans,
scenarios) fold into the unified model as the remaining stages land.

## Why this exists

- Three separate mechanisms do overlapping jobs today, and the orchestration that
  glues them is hand-rolled inside the assistant UI:
  - **Capabilities** (`src/actions/capabilities.ts`) — atomic effects
    (`share-photos`, `send-message`, `create-reminder`).
  - **Plans** (`src/plans/`) — flat `PlanStep[]` sequences, brain-generated.
  - **Slot-fill / clarify loop** (`src/assistant/Assistant.tsx` `pending` →
    `firstPlanGap` / `absorbAnswer`) — "ask the user for the missing input,"
    special-cased and only **one level deep**.
  - **Scenarios** (`src/scenarios/`) — authored, fixed sequences (share
    `resolveStep` primitives with plans).
- Limits this causes: orchestration **can't nest/recurse**, "ask the user" **isn't
  reusable**, and three drivers (assistant / scenarios / autopilot) each walk
  steps their own way.
- **Goal:** one **Task** abstraction + one **interpreter**, where "ask the user"
  is itself a task, composition is recursive, and inference is confidence-graded.

## Core model

- **A Task has:** typed **inputs** (its "slots"), a **body** (a leaf action or a
  sub-task arrangement), and an **output** (a value and/or world events).
- **Four kinds:**
  - **Effect** (leaf) — changes the world; produces events. = today's capabilities.
  - **Query** (leaf) — derives a value, no side effect. = today's brain
    methods / selectors.
  - **Elicit** (leaf, interactive) — asks the human, returns a typed value. = the
    generalization of slot-fill.
  - **Composite** — an ordered/graph arrangement of sub-tasks with data flowing
    between them. = today's plans/scenarios, made recursive.
- Tasks are **first-class, referenced by id** — `pick-contact` is authored once
  and reused by `send`, `share`, `remind-someone`, …

## The task stack (suspend / resume) — the mechanical heart

- A task runs until it needs something it can't resolve → it **pushes a sub-task**
  onto a **task stack** and **suspends**.
- When the sub-task completes, its result is **popped and returned** to the
  parent, which **resumes** where it left off.
- This is a **call stack / coroutine**. Today's `pending` is exactly this with a
  **fixed depth of 1**; making it a stack is what enables arbitrary nesting
  ("get contact → which one? → new contact? → get their number → …").
- Interpreter contract (conceptual):
  `run(task, inputs) → { done, result } | { suspended, ask, resume }`.
- **One interpreter** is shared by every driver (assistant, scenarios, autopilot)
  — no more per-driver step-walkers.

## Input resolution — confidence-ranked, thresholded

- Resolving an input is a **pipeline, not a presence check**. For each input:
  1. **Gather candidates** from every source → `[{ value, confidence, source }, …]`.
     Sources: explicitly passed → context/selection → world/facts → (during an
     elicit) the user's answer.
  2. **Take the best**, compare its confidence to a **threshold**:
     - **≥ high** → bind **silently**.
     - **medium** → bind provisionally + surface a one-tap **confirm** (pre-filled).
     - **< low** → run the **elicit** task from scratch (ask outright).
- **Three bands, not two** — the medium band ("I think it's Sam, right?") is the
  new, valuable one.
- Example (`send`): "send to **Sam**" (named) → **high**; "send this" on a photo
  tagged **only** Sam → **medium** (pre-fill + confirm); "send this" on a
  5-person photo with no name → **low** (open the picker).
- **Precursor:** `shareResolvers.recipients` already walks payload →
  named-in-request → everyone-tagged. The change: each rung returns a
  **confidence**, and "everyone tagged" drops from silent-use to **medium/confirm**
  — which also closes a latent *auto-send-to-all* bug under `auto` supervision.
- **Determinism:** the mock's confidences are deterministic heuristics; the LLM
  brain emits its own confidence per resolved value.
- **✅ Implemented** (`src/actions/requirements.ts`): a `SlotResolver` returns a
  `Candidate { value, confidence, source }`; `bandFor` lands each slot in
  **ok / confirm / elicit**; `resolvePlanSlots` binds only `high` (so a `medium`
  default is confirmed pre-filled, never silently sent — closing the latent
  auto-send-to-all); `firstPlanGap` carries the `{ candidate, band }`, and
  `acceptGap` folds a tapped confirm back onto the step. The medium band renders
  as a one-tap `✓ …` confirm chip in the ambient surface; low → asks outright;
  high → binds silently.

## Confidence threshold = the supervision dial

- The threshold is **not a new knob** — it's the existing supervision level
  (`Supervision`, `src/plans/types.ts`) given a precise meaning:
  - `auto` → **low** threshold (act on medium guesses).
  - `confirm-once` → **medium**.
  - `confirm-each` → **high** (even confident guesses get a confirm).
- I.e. **supervision level = how confident an inference must be before the task
  stops asking.**
- **✅ Implemented**: `meetsThreshold(confidence, supervision)`. The pre-preview
  clarify pass uses a fixed `DEFAULT_SUPERVISION` (`confirm-once`) since
  supervision is picked later at the PlanSheet; unifying the two into one dial
  (pick supervision *before* clarify) is an open thread.

## Elicit tasks — one question, two answer channels

- An elicit task declares a **value kind** (contact / photo-set / date / choice /
  free text); the kind drives the UI.
- **Channel A — structured picker:** a `valueKind → PickerComponent` registry
  (same pattern as `appId → renderer`, `intent → propose`). A tap is
  unambiguous → **max confidence**. New kind = drop a picker + one registry line.
- **Channel B — natural language, in the same chat:** the user types ("send it to
  my sister"); the elicit's `parse` (reusing deterministic lookups like
  `requestedShareRecipients`) → a typed value **with a confidence**.
- Both channels feed the **same suspended task** and re-enter the **same threshold
  check** — so an ambiguous NL answer ("send to J" → Jamie? Jordan?)
  **re-elicits to disambiguate**: the elicit pushes another elicit (recursion,
  handled by the stack for free).
- **Reuse the ambient assistant surface:** it already has a hint pill (tap a
  candidate) + a live text box (NL). An elicit = the hint pill becomes a
  **candidate-chip row** (pre-selecting the medium guess), and richer kinds swap
  in a `valueKind` picker. The medium-confidence "confirm" and low-confidence
  "pick" are the **same UI** — one just opens pre-filled.
- **✅ Implemented**: slots declare a `valueKind` in their world file
  (`src/world/schema.ts`); a `valueKind → parse` registry
  (`src/actions/valueKinds.ts`, deterministic — `contact` reuses `matchContacts`,
  `text` is verbatim) is the NL channel, and a `valueKind → picker` registry
  (`src/assistant/pickers/` — `ContactPicker` today) is the structured channel.
  Both produce a `Candidate` bound through one path (`bindGapValue`); a typed
  answer parsing to several names fans out to a `ChoicePicker` (disambiguation),
  a one-level re-elicit that becomes fully recursive once the task stack lands.
  Shipped kinds: **contact** + **choice**; **photo-set**/**date** are declared
  but fall through to the text input for now.

## Stakes — the consent gate

- **Stakes is a third dimension**, orthogonal to confidence and supervision:
  - **Confidence** — am I sure *what* to do (the inputs)? → governs whether to
    **elicit**.
  - **Stakes** — how bad if I'm wrong / how hard to undo (the *effect*)? →
    governs whether the **commit** needs **consent**.
  - **Supervision** — how closely the user chose to watch → the run's default
    friction.
- **The stakes boundary is `propose → commit`** (`src/actions/`): drafting a
  proposal (writing the message, building the cart) is always free; the
  **commit** is the consequential act. A high-stakes task is one whose *commit*
  requires consent.
- **Binary for now:** `low | high`. High-stakes commits pass through a **consent
  gate**; low-stakes commits don't.
- **Explicitly declared for now** (in the action's world file, like any other
  capability property), but the declaration *stands in for* a judgment about
  **reversibility** and **cost of reversal** — the effort + cognition to undo it:
  - *low*: reversible cheaply/automatically (save a draft, add to cart → remove,
    create a reminder).
  - *high*: irreversible or expensive to reverse (send a message — no unsend;
    make a purchase — money moved + refund friction; delete).
- **Stakes sets a floor supervision can't lower:** even in `auto` ("just do it"),
  a high-stakes commit still stops for consent. This joins a family of
  **non-waivable commit gates** — *autonomy never overrides* any of them:
  1. **Validity gate** — invalid proposal (`invalidReason`, `capabilities.ts`).
     *(exists)*
  2. **Input gate** — a required input missing / below the confidence threshold →
     elicit. *(designed)*
  3. **Consent gate** — high-stakes effect → confirm. *(new)*
- **The gates compose, input before consent:** resolve *what* (elicit uncertain
  inputs), then consent to *whether*. The consent prompt always shows the
  **final, concrete** act — "Send to Sam: 'see you at 6'? — Send / Cancel" —
  never a placeholder.
- **Consent is per-action for now.** A later expansion: **scoped grants** —
  consent pre-granted with a scope (this session, purchases under $X, always to
  Sam) that deliberately lowers the floor, distinct from the supervision dial
  which can never touch it (see Open threads).
- **Context can escalate a declared baseline** (parallel to computed confidence):
  blast radius (recipient count), amount. Deterministic in the mock.
- **Determinism / mock:** the stakes level + any escalation is a pure function of
  the action + operands; the consent gate is UI, so the offline path is unchanged.
- **Research telemetry:** stakes and each consent decision (granted/denied,
  latency) are first-class log events — the trust dynamic the prototype is built
  to study.

## Composition — authored + brain, one interpreter

- **Reusable simple tasks + common recipes are authored as content**
  (deterministic, offline-safe — "content ≠ code").
- **The brain can also assemble a composite on the fly** for novel requests (like
  today's plans).
- Both produce the same **Task** shape and run through the **same interpreter** —
  the mock/offline guarantee is preserved while still designing for Gemini.

## Data flow

- **Results return up the task stack** — a sub-task hands its value to whoever
  pushed it; the parent resumes with it bound. Simple, local, easy to reason about.
- **`ContextBundle` stays the read-only ambient blackboard** — "what's true about
  the world right now" (owner, selection, facts). Task *results* flow via the
  stack; ambient world is *read* from context.

## LLM call cost — cache the prefix, retrieve the context

Focus: **per-call token size** — the dominant cost as the world and capability
catalog grow. (Call *count* is already ~1 per novel request; keep it that way.)

- **Target property:** cost scales with **novelty**, not with world size or
  capability count. A richer world / bigger catalog should inflate only the
  **cached prefix** (paid ~once per session) and the **local retrieval corpus**
  (queried, never fully shipped) — never the per-call token bill.
- **Call-count invariant (already held — keep it):**
  - **One model call per novel request** — `respond()` returns the whole plan;
    execution, clarification, and consent are local (0 calls).
  - **Slot-filling answers are free** — folded + re-checked locally
    (`absorbAnswer` / `firstPlanGap`), no brain call.
  - **Non-decider work is deterministic/local** — grouping, drafts, resolvers,
    confidence, suggestions delegate to the mock; only `respond()` spends tokens.
  - Never put the model in the execution loop, however many task types are added.
- **Split every request into two zones:**
  - **Cacheable prefix (stable across a session):** persona + OS rules + the
    **full tool catalog** + the response contract. Grows with capabilities but is
    paid ~once, not per turn.
  - **Volatile suffix (per turn, kept small):** a retrieved context slice +
    compacted history + the new message.
- **Provider-specific caching at the boundary:** the neutral `LLMRequest` gains a
  way to **mark its cacheable prefix**; each provider adapter applies its native
  mechanism at the network edge — Gemini `cachedContent`, Anthropic
  `cache_control` — so upstream stays provider-neutral while the boundary
  optimizes. **Requirement:** the prefix must be byte-stable across turns, so no
  volatile data may be interleaved into it (today `buildSystemPrompt` mixes the
  Situation/gallery into the system string — that moves to the volatile suffix).
- **Retrieval, not world-dump:** replace the whole-gallery serialization with a
  deterministic **relevance slice** — selected objects, people named in the
  request (`requestedShareRecipients`), and recency windows (already used:
  `messagesInvolving(...).slice(-10)`). Ground truth stays committed metadata;
  only the *relevant* ground truth ships.
- **History compaction:** window recent turns + a running summary of older ones,
  instead of re-sending the full thread.
- **Decision — cache the full catalog; do NOT subset tools per request.**
  Per-request tool subsetting shrinks a payload but **busts the prefix cache**
  every turn; with caching as the primary size lever, a stable fully-cached
  catalog wins. (Revisit only if the catalog grows so large the cached write
  itself hurts.)
- **Determinism / mock:** retrieval and prefix assembly are pure local functions;
  the mock/offline path spends no tokens and is unaffected (principle 8).
- **Secondary lever (call count):** authored **recipes / memoized plans**
  short-circuit the model entirely for known tasks (0 calls) — as the recipe
  library grows, the fraction of requests reaching the model drops (see
  Composition).
- **Measured, not assumed:** log **input/output tokens per call + cache-hit
  rate** in the trace, so a size reduction is verified to preserve task success
  ("minimize without losing capability").

## Alignment with project principles

- **Content ≠ code** — leaf primitives (effect/query) in code; simple/composite
  tasks + recipes authored in `world/`.
- **Deterministic / mock-first** — deterministic-heuristic confidences (exact
  match = high, sole-default = medium, none = low); pickers work offline; NL parse
  reuses existing deterministic lookups. Principle 8 intact.
- **One pipeline** — every task effect still goes through `propose → commit`.
- **Modular & additive** — new task / value-kind / picker = drop a file + a
  registry line.
- **Validate loudly** — task defs, their input/kind references, and a declared
  `stakes` level are schema-checked and joined at load, like the capability
  registry.

## Open threads (expand as the system grows)

- **Recipe format** — how an authored composite task declares its sub-structure
  and per-input resolver chain (vs. what the brain emits).
- **Confirmation batching** — medium-confidence confirms interrupt per-input as you
  go, vs. batched into one review at the end.
- **Registry shapes** — concrete task / value-kind registries and their load-time
  integrity checks.
- **Persistence** — whether a suspended task stack survives reload (like the event
  log) and how it's traced for research instrumentation.
- **Value kinds** — the initial set of pickers (contact, photo-set, date, choice,
  text) and their parsers.
- **Scoped consent grants** — expand per-action consent to grants with a scope
  (session / amount threshold / per-recipient) that deliberately lower the stakes
  floor; logged as telemetry.
- **Derived stakes** — compute a task's stakes from its reversibility / cost of
  reversal (does a cheap compensating/undo task exist?), instead of an explicit
  declaration.
- **Retrieval ranking** — the volatile context slice uses deterministic signals
  (selection, named entities, recency) today; a smarter, still-offline relevance
  ranker is a later refinement.
