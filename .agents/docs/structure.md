# Structure

This document outlines the system topology, technology choices, cross-cutting patterns, and unresolved architectural decisions for `dockdi`.

---

## Stack

Technology decisions and rationales for the core library implementation:

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5 (`strict: true`) | Provides necessary advanced type inference, phantom types, and compile-time validation without requiring runtime type generation. |
| Development / Test Runtime | Bun | Offers native TypeScript execution, high-performance unit test runners, and fast local iteration cycles. |
| Target Bundles | Dual ESM and CommonJS | Ensures seamless compatibility across modern ESM-first environments and existing CommonJS services with full `.d.ts` declaration maps. |

## Topology

`dockdi` is structured as a modular in-memory library centered on the Composition Root architectural pattern:

```text
[Application Entrypoint (Composition Root)]
                  │
                  ▼
         [Container Registry]
                  │
      ┌───────────┴───────────┐
      ▼                       ▼
 [Binding Store]     [Instance Cache (Scopes)]
      │                       │
      └───────────┬───────────┘
                  ▼
          [Graph Resolver]
                  │
                  ▼
  [Instantiated Dependency Graph]
```

- **Composition Root**: Applications create container instances and register token bindings exclusively at application startup. Business logic remains decoupled from the container.
- **Registry & Binding Store**: Maps tokens to resolution strategies (`toClass`, `toFactory`, `toValue`).
- **Graph Resolver**: Traverses dependency requirements for requested tokens, resolving parameter bindings recursively while asserting cycle constraints.
- **Instance Cache**: Stores long-lived references for singletons, bypassed for transient resolutions.

## Cross-cutting patterns

- **Branded Phantom Types**: Compile-time typing attached to native `Symbol` tokens, preventing type confusion during resolution without generating runtime inspection artifacts.
- **Cycle Detection via Resolution Stack**: The resolver maintains an ordered path of active token resolutions. Encountering an active token triggers a diagnostic error formatted with the complete cycle sequence: `A -> B -> C -> A`.
- **Diagnostic Error Hierarchy**: Custom error classes differentiate missing registrations, cyclic dependencies, and invalid constructor mappings with actionable guidance.

## Open architecture decisions

- **Constructor-to-Tokens Association Design**: Determining the exact ergonomic syntax to link constructor parameters with tokens without decorator reflection, addressing fragility found in existing libraries. Dependent on Phase 0 prototyping.
- **Binding Method Vocabulary**: Choosing between explicit descriptive methods (`toClass`, `toFactory`, `toValue`) versus generalized binding methods.
- **Resolution Scope Inclusion**: Deciding whether resolution-scoped lifetimes (cached within a single resolution tree) enter v1 or defer to v2 based on implementation complexity.

---

## Non-goals

The library will not provide a global, ambient container singleton or service locator pattern. All container instances must be explicitly instantiated and managed by the consumer.
