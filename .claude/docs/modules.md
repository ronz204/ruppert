# Modules

This file covers what each core concept is responsible for and how it is expected to behave once implemented. Why these concepts exist and how they relate as a domain model lives in overview.md, not here. No production implementation exists yet beyond an initial scaffold — every flow below describes the intended responsibility per the project's roadmap, not code that has landed; the concrete API shape (binding-method names, exact call signatures) is still an open design decision and is deliberately not fixed here.

---

## Token

**Purpose.** Represents "something resolvable of a given type" as a runtime-unique identifier that also carries type information at compile time.

**Flow.** Created once per distinct dependency a consumer wants to make resolvable. Used both when registering a binding against it and when requesting resolution — the same token value must be presented at both steps for the container to associate the two correctly.

**Data shape.** A unique runtime value (no two independently created tokens are ever equal) combined with a compile-time-only type marker; the marker contributes nothing to the token's runtime shape.

## Container

**Purpose.** Holds the mapping from every registered token to its binding, and is the single point through which resolution happens.

**Flow.** A binding is registered against a token before any resolution is requested against that token. Resolution accepts a token and returns the value produced by that token's binding, applying whatever scope that binding was registered with. Requesting resolution for a token with no registered binding is an error condition, not a silent fallback — the error is expected to report the full resolution chain that led to the missing token, not just the missing token in isolation. A dependency cycle across bindings is the same category of error: reported with the full chain, not just the point of failure.

**Data shape.** Internally, a mapping from token to binding (plus whatever per-scope instance cache singleton and resolution-scope bindings require). No shape is exposed to consumers beyond the token-in, value-out resolution call.

## Binding

**Purpose.** The concrete strategy that produces a value for a given token — constructing a class via its constructor, invoking a factory function, or returning a fixed value directly.

**Flow.** Selected at registration time per token, not decided dynamically at resolution time. A class-backed binding must resolve that class's own constructor dependencies (via the constructor-to-token mapping mechanism) before constructing it, recursively, following the same resolution path as any other token.

**Data shape.** Not yet fixed — depends on the outcome of the constructor-to-token mapping design decision.

## Scope

**Purpose.** Governs how many times a binding's underlying value is actually produced across multiple resolution calls.

**Flow.** Transient: a fresh value every resolution. Singleton: one value produced on first resolution, reused for the container's remaining lifetime. Resolution-scope (not yet committed to the first version): one value reused only within a single top-level resolution call's dependency graph, discarded after that call completes.

**Data shape.** Not yet fixed — depends on which scopes ship in the first version.

---

## Non-goals

Does not document a concrete public API (method names, call signatures) — none is settled yet, pending the constructor-to-token mapping design decision.
