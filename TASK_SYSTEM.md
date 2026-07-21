# Task System

> **Single source of truth for the Task System's concept and design.** This is a
> **living doc** — expand it as the system's complexity grows. Keep `CLAUDE.md`
> and `README.md` *pointing here*; do not duplicate the model in them.

**Status:** design / concept — not yet implemented. The engine today has
*precursors* (capabilities, plans, slot-filling, scenarios); this doc defines the
unified model they fold into.

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

## Confidence threshold = the supervision dial

- The threshold is **not a new knob** — it's the existing supervision level
  (`Supervision`, `src/plans/types.ts`) given a precise meaning:
  - `auto` → **low** threshold (act on medium guesses).
  - `confirm-once` → **medium**.
  - `confirm-each` → **high** (even confident guesses get a confirm).
- I.e. **supervision level = how confident an inference must be before the task
  stops asking.**

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

## Alignment with project principles

- **Content ≠ code** — leaf primitives (effect/query) in code; simple/composite
  tasks + recipes authored in `world/`.
- **Deterministic / mock-first** — deterministic-heuristic confidences (exact
  match = high, sole-default = medium, none = low); pickers work offline; NL parse
  reuses existing deterministic lookups. Principle 8 intact.
- **One pipeline** — every task effect still goes through `propose → commit`.
- **Modular & additive** — new task / value-kind / picker = drop a file + a
  registry line.
- **Validate loudly** — task defs and their input/kind references are
  schema-checked and joined at load, like the capability registry.

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
