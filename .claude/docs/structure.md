# Structure

This file covers the technology stack, how the pieces will communicate, and infrastructure topology. The data model itself belongs in database.md, and it states plainly why that file is not applicable here.

---

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript, strict mode | The type system is the primary safety mechanism this project relies on in place of runtime reflection — strict mode (no implicit any, no unchecked indexed access, no implicit override) is load-bearing, not incidental. |
| Runtime / package manager | Bun | Chosen to prototype and validate the core token/resolver mechanism directly, without a separate build step getting in the way during the design-validation phase. |
| Module resolution | Bundler-mode resolution, ESNext target | Matches how the compiled output is expected to be consumed by downstream bundlers rather than assuming a specific runtime's module loader. |
| Distribution format | Dual ESM/CJS build with bundled `.d.ts` | Consumers span both module systems; committing to only one would push the compatibility problem onto every consumer instead of solving it once at build time. This is a planned build-phase decision, not yet implemented. |

## Topology

dockdi is a library, not a service — it has no request path, no server process, and no network-reachable surface of its own. It is imported directly into a consuming application's composition root, where bindings are assembled once, and resolved calls happen in-process against the caller's own runtime.

```
consuming application
  └── composition root (assembles bindings once)
        └── container.get(token) — in-process, synchronous by default
```

## Cross-cutting patterns

No cross-cutting patterns beyond the project-wide invariants apply yet — there is no cross-component behavior (auth, background jobs, caching) to describe, because the library has no components beyond the token/container/binding/scope concepts themselves. The invariants that do apply everywhere (zero decorators, zero production dependencies, synchronous-default resolution with async as opt-in) are each their own enforced convention rather than described here.

## Open architecture decisions

- **Constructor-to-token mapping mechanism.** Nothing has resolved how a constructor's parameters get associated with tokens without runtime reflection. This is the single most consequential open decision in the project: if no mechanism meaningfully improves on requiring a separately-maintained, order-dependent list of tokens per constructor, the project risks not offering a real design advantage over that approach. Resolving this is a prerequisite for building any real container implementation.
- **Whether hierarchical/child containers are in scope for the first version**, pending how the core mechanism above turns out — a container design that makes child scoping awkward would push this decision later regardless of preference.
- **Final binding-method vocabulary** (how a binding declares itself as a class, a factory, or a fixed value) is unsettled — a naming proposal exists but hasn't been validated against real usage.
- **Whether resolution-scope (an instance shared only within one resolution graph) ships in the first version** or is deferred, pending how often it turns out to be needed once constructor injection and the two simpler scopes are in real use.

---

## Non-goals

Nothing here describes hosting, provisioned infrastructure, or environments — dockdi is distributed as a published package with no runtime infrastructure of its own to operate.
