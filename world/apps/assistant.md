---
id: assistant
name: Assistant
icon: ✨
category: system
capabilities: [chat-threads, conversation-history]
---
The Assistant app is the owner's conversation history with their on-device
assistant. Each request made through the floating assistant button is its own
thread (a fresh conversation id is minted whenever the assistant is invoked
outside an existing thread); this app lists those threads and lets the owner
resume one — reopening the assistant bound to that conversation, history and
all. It declares no actions: the chat, plans, and proposals all live in the
persistent assistant surface, and this app is a window onto their record.
