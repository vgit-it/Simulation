---
id: photos
name: Photos
icon: 🖼️
category: media
capabilities: [browse-gallery, group-by-time, group-by-people, share]
actions:
  - id: share-photos
    label: Share
    intelligence: share-photos
    selection: { kind: photos, min: 1, prompt: "Which photos do you want to share?", valueKind: photo-set }
    requires:
      - key: recipients
        prompt: "Who should I share these with?"
        valueKind: contact
---
Photos surfaces the owner's gallery. "Who is in a photo" and "which photos are
from this week" come from committed metadata sidecars, not image analysis — the
image pixels are irrelevant placeholders. This keeps the simulation
deterministic and spends no LLM tokens on perception.
