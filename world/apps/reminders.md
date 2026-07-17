---
id: reminders
name: Reminders
icon: ⏰
category: productivity
capabilities: [list-reminders, create-reminder]
actions:
  - id: create-reminder
    label: Remind me
---
Reminders is the owner's lightweight to-do surface. Reminders are runtime
state — `ReminderCreated` events in the world log — created either directly in
the app or by the assistant as a plan step ("…and remind me to print one").
A reminder can reference photos (its `related` ids), which render as thumbnail
context. The `create-reminder` action needs nothing selected: its content
arrives as an action payload (the title), drafted by the brain or typed by the
user.
