---
paths:
  - "libraries/dockdi-ts/source/**"
---

# Synchronous-Default, Async-Opt-In Resolution Conventions

Applies to the library's own resolution logic. Both synchronous and asynchronous resolution are required, fully-supported capabilities of dockdi — this rule governs which one is the implicit path, not which one is allowed to exist.

---

## The implicit resolution path is always synchronous

- Any resolution call that doesn't explicitly request asynchronous behavior must resolve synchronously, because a container caller should never be forced to deal with a `Promise` (or await machinery) unless something they registered actually required it — an implicitly-async default would impose that cost on every consumer, including the majority who never need it.
- Asynchronous resolution must be reached through a separate, explicitly-named path (e.g. a distinct method or a binding explicitly declared as async), never inferred automatically from whether a factory happens to return a promise — inferring it would make the sync/async boundary invisible at the call site, which is exactly the ambiguity this convention exists to prevent.
- Async support must stay complete and first-class along this explicit path — this convention is not a license to under-build or defer async resolution; it only fixes which mode is the default when neither is requested explicitly.

---

## Non-goals

Doesn't mean async resolution is optional to implement or secondary in priority — see the functional scope in `.claude/docs/approach.md`, where it's a required capability, just not the implicit one.
