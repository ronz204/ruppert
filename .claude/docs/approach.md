# Approach

This file covers the order and philosophy behind building dockdi — what gets built together and in what sequence. Why the project exists lives in overview.md; how the pieces communicate lives in structure.md.

---

## Technical pillars

| Pillar | What it means here |
|---|---|
| Type-first safety | Compile-time type checking, via branded tokens, is the sole safety mechanism for matching dependencies to their consumers — there is no runtime metadata layer backing it up. |
| Zero decorators / zero reflection | No decorator syntax and no reflection-metadata library, at any point, even as an optional path — this is tied to type-first safety because reflection-based metadata is exactly the alternative this project is deliberately not adopting. |
| Zero production dependencies | The published library ships with no runtime dependencies. This is tied to the other two pillars: reflection-free, type-first DI is achievable without a supporting runtime library, so adding one would be an unforced compromise. |

These three are built together deliberately, not bolted on separately — dropping any one of them (e.g. accepting one reflection-based dependency "just for this one feature") undermines the reason the other two matter.

## Functional scope

- Register a binding (class, factory, or fixed value) against a token, and resolve that token back into a value.
- Govern instance lifetime via scope (at minimum transient and singleton).
- Detect and report, with the full resolution chain, both a missing-token error and a dependency cycle.
- Support an explicit, opt-in asynchronous resolution path without changing the synchronous default.
- Provide a mechanism to override/mock a binding scoped to an individual test.
- Publish as a dual ESM/CJS build with bundled type declarations.

## Roadmap

0. **Core mechanism and validation** — prototype the branded token and a minimal resolver without reflection, focused on deciding the constructor-to-token mapping mechanism. This phase is not yet complete; nothing past it should be treated as unblocked until this phase's design decision is settled.
1. **Minimal core container** — `bind`/resolve, a single (transient) scope, basic missing-token errors, end to end.
2. **Scopes** — add singleton and resolution-scope, with lifecycle test coverage per scope.
3. **Error developer experience** — cycle detection with a full resolution chain, missing-token messages with suggestions (e.g. similarly-named registered tokens). Treated as a real differentiator, not an afterthought.
4. **Async factories** — opt-in asynchronous resolution without disturbing the synchronous default path.
5. **Testing utilities** — a binding override/mock mechanism scoped to a single test.
6. **Packaging and publication** — dual ESM/CJS build, a bundle-size budget, public documentation, npm publish.
7. **(Future, beyond current scope) Hierarchical containers and framework integrations** — child containers, and a native integration with a specific web framework once the core is stable.

## Done criteria

- Phase 0 is done when a branded token and a minimal resolver compile and run successfully in the chosen runtime, and the constructor-to-token mapping approach is written down as a settled design decision (not left implicit in the prototype code).
- The functional scope above is done when every bullet in it is implemented and covered by a passing test for its success path and its documented failure path (missing token, cycle).
- Zero-production-dependency and zero-decorator invariants are done, and stay done, as long as the published package manifest declares no runtime dependencies and no source file uses decorator syntax or a reflection-metadata import — both are continuously checkable, not a one-time milestone.

## Stretch goals

- Hierarchical/child containers (phase 7).
- A native integration with a specific web framework's request lifecycle (phase 7).

---

## Non-goals

This file does not restate the domain model (token, container, binding, scope) — that vocabulary lives in overview.md.
