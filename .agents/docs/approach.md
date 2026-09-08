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
