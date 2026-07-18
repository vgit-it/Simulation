---
id: evening-catchup
name: Evening catch-up
description: >-
  Ava shares her picnic photo with Sam, the afternoon passes and Sam's
  autopilot replies on its own, Maya checks in by message, and Ava comes back
  to a badged inbox.
steps:
  - kind: focus
    person: ava-chen
    screen:
      app: photos
  - kind: share
    person: ava-chen
    photos: [img-001]
  - kind: clock
    at: '2026-07-16T15:30:00'
  - kind: message
    person: maya-osei
    to: [ava-chen]
    text: "Brunch tomorrow? The market has figs again 🥐"
  - kind: focus
    person: ava-chen
    screen: home
  - kind: focus
    person: ava-chen
    screen:
      app: messages
---
The world acting back, end to end. Ava shares with Sam; the clock jumps past
his `auto-reply` delay, so his scripted reaction lands by itself (resident
autopilot — no step here sends it). Maya's check-in is a scripted `message`
step. The final cuts return to Ava's phone: her home screen shows the Messages
badge, and her inbox holds two unread threads she never watched arrive.
