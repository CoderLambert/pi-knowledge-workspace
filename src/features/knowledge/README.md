# First-party Knowledge Feature

This directory is reserved for Pi Knowledge first-party UI/integration code in the thin fork.

## Boundary

Allowed here:

- Knowledge workspace navigation/panel
- Sources / Search / Ask / Notes UI
- client state specific to Knowledge
- thin typed calls to the Knowledge service bridge
- Source/Evidence viewer integration

Not allowed here:

- document parsing
- embeddings
- retrieval index implementation
- SQLite ownership
- durable worker execution
- unrestricted Pi model/runtime configuration

Those belong behind the `pi-knowledge` service boundary.

## V1 UI

```text
Knowledge
├─ Sources
├─ Search
├─ Ask
└─ Notes
```

Course/Learning is V1.1+ and should not be introduced into the V1 slice before Knowledge Ask + Notes pass their release gates.

This README intentionally creates the ownership seam before implementation. Do not add speculative frameworks or abstractions until a concrete feature needs them.
