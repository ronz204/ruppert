# Overview

This file covers what dockdi is for and the vocabulary its design is built on. How each concept is actually implemented lives in modules.md, not here; how components communicate lives in structure.md.

---

## Vision

Wiring a class's dependencies in TypeScript today forces a choice: accept decorators plus `reflect-metadata` (extra compiler flags, a runtime polyfill, metadata that only exists because the type system itself can't be queried at runtime), or accept a container that can resolve tokens but can't verify at compile time that a constructor's parameters actually match the tokens supplied for it — the gap other lightweight, reflection-free containers leave open by requiring the constructor-to-token mapping to be declared as a second, separately-maintained list.

dockdi's reason to exist is closing that specific gap: make declaring and resolving dependencies feel type-safe at compile time, with a runtime cost no higher than passing around plain `Symbol` values, and without requiring any non-standard compiler behavior. It is not attempting to match the feature surface of a full-featured DI framework — it targets one problem (constructor injection, token-safe, reflection-free) and treats everything else as explicitly out of scope until that core is solid.

## Scope & non-goals

In scope: declaring typed tokens, registering resolution strategies against them, resolving a dependency graph from those tokens (synchronously by default, asynchronously as an explicit opt-in), governing instance lifetime via scopes, and giving actionable errors when resolution fails.

Out of scope for the current version:
- Property injection — constructor injection is the only supported mechanism.
- Any form of decorators, including an optional/opt-in one — the zero-decorator invariant applies unconditionally.
- Framework-specific integrations — these are deferred to a later phase once the core resolution mechanism is proven.
- Hierarchical/child containers — undecided; may be pulled into scope or deferred further depending on how the core mechanism's design turns out.

## Domain concepts

| Concept | Description |
|---|---|
| Token | A runtime-typed identifier representing "something resolvable of a given type." Carries its type only at compile time (a phantom type); at runtime it behaves like a plain unique value. Nothing is resolvable without a token — it is the atomic unit the rest of the system builds on. |
| Container | The registry mapping tokens to their resolution strategy. Exposes a minimal surface for registering a strategy against a token and resolving a token back into a value. |
| Binding | The concrete strategy satisfying a given token — constructing a class, invoking a factory function, or returning a fixed value. |
| Scope | Governs the lifetime of a resolved instance — whether a fresh instance is created per resolution, one instance is shared for the container's lifetime, or one instance is shared only within a single resolution graph. |
| Composition root | The single place in a consuming application where bindings are assembled. Everything else in that application is expected to receive its dependencies rather than reach into the container directly. |
| Constructor-to-token mapping | The mechanism associating each parameter of a constructor with the token that should supply it, without relying on runtime reflection. This is the central open design problem the rest of the system depends on. |

---

## Non-goals

Ambient/global container access (a service-locator pattern reached from arbitrary code rather than only from the composition root) is deliberately not a target usage pattern — it defeats the compile-time guarantees the token model exists to provide.
