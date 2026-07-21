---
id: messages
name: Messages
icon: 💬
category: communication
capabilities: [inbox, threads, receive-shares, send]
actions:
  - id: send-message
    label: Message
    selection: { kind: people, min: 1, prompt: "Who do you want to message?" }
    requires:
      - key: text
        prompt: "What should the message say?"
        optional: true
---
Messages is the owner's inbox. Conversations are derived from the world's global
event log — every share or message sent to this person "arrives" here — grouped
into threads by participant set. Photo attachments resolve to thumbnails from the
sender's gallery. Replying is live: the thread composer and the assistant's
`send-message` capability go through the same propose→commit pipeline. The
action's selection kind is `people` — opening a thread selects its participants,
and tapping a contact in Contacts selects that person, so "message *them*" can
bind from either app.
