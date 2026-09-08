# Approach

This document defines the engineering pillars, phased delivery roadmap, and verification criteria for building `dockdi`.

---

## Technical pillars

The library combines four technical requirements to satisfy its core design objectives:

| Pillar | What it means here |
|---|---|
| Branded tokens without reflection | Eliminates compiler flags and runtime reflection libraries by relying on compile-time phantom types attached to native `Symbol` identifiers. |
| Zero production dependencies | The published library ships with zero runtime dependencies, ensuring minimal footprint, zero supply chain risk, and trivial integration into any runtime. |
| Rich error DX | Dependency cycles and unresolved tokens output the entire resolution chain leading to the failure point, rather than terminating with opaque null references. |
| Synchronous-first resolution | Resolution is strictly synchronous by default; asynchronous resolution is an explicit, opt-in mechanism to prevent async contamination across synchronous domain models. |

## Functional scope

The library will implement:
- Branded token instantiation with phantom type parameters.
- Container binding APIs supporting class constructors, factory functions, and static values.
- Lifecycle management supporting transient and singleton resolutions.
- Traversal algorithms to detect circular dependencies before stack exhaustion.
- Opt-in asynchronous resolution for asynchronous factory bindings.
- Test override utilities to substitute token bindings within isolated test suites.
- Dual-target compilation outputting both ESM and CommonJS artifacts with full TypeScript definitions.

## Roadmap

0. **Phase 0: Core mechanism prototype** — Design and validate the constructor-to-tokens mapping without decorators or reflection. Verify prototype execution using Bun.
1. **Phase 1: Minimal container core** — Deliver `bind` and `get` operations supporting transient scope and standard missing-token errors.
2. **Phase 2: Scopes** — Implement singleton caching and evaluate resolution-scope lifecycles with instance identity validation tests.
3. **Phase 3: Error diagnostics DX** — Implement full-chain circular dependency reporting and missing-token remediation suggestions.
4. **Phase 4: Asynchronous resolution** — Introduce explicit asynchronous resolution workflows for asynchronous factories without altering the synchronous resolution path.
5. **Phase 5: Test isolation utilities** — Implement declarative binding overrides and container snapshots for unit testing suites.
6. **Phase 6: Packaging and distribution** — Configure dual ESM/CJS build pipelines, verify bundle size budgets, and publish to npm registry.

## Risks

- **The constructor-to-token mapping mechanism might not turn out to be a genuine improvement over the separately-maintained-list approach** other reflection-free containers already use — an explicit, order-dependent list of tokens kept in sync by hand against a constructor's parameters, with nothing catching drift between the two until it manifests as a wrong value at runtime. If Phase 0 can't find a mechanism the compiler itself can verify stays in sync, dockdi risks ending up as just another reflection-free container with no real differentiation from that existing approach. This is the most consequential risk in the project: it threatens dockdi's entire reason to exist — closing the exact gap other reflection-free containers leave open — not just an implementation-quality concern.
- **Branded types can produce confusing TypeScript inference errors in edge cases** — nested generics, unions of branded types — that don't surface in the simple case. This needs to be tested early against realistic usage, not assumed solved because a minimal example compiles cleanly.
- **Rich error DX and async support both create pressure toward a runtime dependency**, which the zero-production-dependency invariant forbids. Detailed error messages (with suggestions for near-miss tokens) and async resolution machinery are exactly the kind of feature that's tempting to reach for a small utility library to build well. Holding the invariant means solving both without one, not treating the invariant as negotiable once a feature seems to need it.
- **Scope surface creep**: adding more scope kinds than are validated as actually needed, before real usage confirms the need, complicates the API for every consumer — including the ones who would never use the extra scopes.

## Done criteria

The initial implementation milestone is complete when:
- Constructor injection operates without `experimentalDecorators` or `emitDecoratorMetadata` enabled in TypeScript configuration.
- A test suite verifies that transient bindings return distinct instances while singletons preserve reference equality across resolution calls.
- Circular dependency tests confirm that error messages include the complete token cycle path.
- Build scripts generate both ESM and CommonJS outputs that pass type checking against a consumer project with TypeScript 5.

## Stretch goals

Deferred capabilities evaluated following core stabilization:
- Hierarchical child containers with parent resolution fallback.
- Native framework bindings tailored for Bun web frameworks such as Elysia.

---

## Non-goals

No phase of this roadmap will introduce compatibility shims for `reflect-metadata` or decorator-based parameter injection.
