---
id: threads
name: Threads
icon: 🧵
category: system
capabilities: [thread-history, consolidation]
---
Threads shows what the owner is part-way through — the ongoing efforts that
photos, messages, plans and reminders accumulate against, rather than a list of
discrete to-dos. Each thread ("strand" in code, to keep it distinct from a
message thread or an assistant conversation) carries a status and the items
filed into it.

Threads come from two places. The authored seed lives in the owner's
`threads.md`; **Consolidate** asks their assistant to fold everything that has
happened since into the thread it belongs to, starting new threads for activity
that fits nowhere. Consolidation is idempotent — every item carries the id of
where it came from, so pressing the button twice folds nothing the second time.

It declares no actions: nothing about a thread is proposable yet, so the
assistant's action space is unchanged. This app is a window onto the record.
