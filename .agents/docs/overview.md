# Overview

This document defines the core vision, domain model, and operational boundaries of the `dockdi` dependency injection library.

---

## Vision

`dockdi` is a type-first dependency injection container for TypeScript designed around explicit branded tokens (phantom types) rather than runtime decorator reflection via `reflect-metadata`. It eliminates the configuration complexity, compilation flags, and runtime overhead typical of traditional inversion-of-control libraries while preserving complete compile-time type safety across token declarations and resolution points.

The primary architectural goal is providing natural, type-safe dependency declaration and resolution without modifying compiler settings or relying on global runtime polyfills.

## Scope & non-goals

The library owns:
- Type-safe token creation using phantom types.
- Container registration and binding mapping.
- Synchronous-first dependency resolution with explicit asynchronous opt-in.
- Instance lifecycle management across predefined scopes.
- Dependency graph traversal, circular dependency detection, and comprehensive diagnostic error reporting.
- Dual distribution targeting ESM and CommonJS runtimes with zero external production dependencies.

Explicit non-goals for the initial release include:
- Property injection: resolution is strictly constrained to constructor parameters and factory arguments.
- Decorators in any form: decorator-based injection and metadata generation are excluded entirely.
- Direct framework integration layers: integrations with web or application frameworks remain downstream concerns outside this core library.
- Child or hierarchical container trees: multi-tier hierarchical resolution is deferred beyond the initial foundational implementation.

## Domain concepts

The vocabulary and architectural roles governing `dockdi` are detailed below:

| Concept | Description |
|---|---|
| `Token<T>` | The fundamental resolvable unit. A typed runtime identifier represented as a unique `Symbol` tagged with a phantom type `T` that carries compile-time type information with zero runtime payload. |
| `Container` | The central registry holding bindings between tokens and their concrete resolution strategies. Serves as the resolution engine exposing registration and retrieval interfaces. |
| `Binding` | The resolution strategy bound to a token, determining how a requested dependency is satisfied (class instantiation, factory evaluation, or static constant value). |
| `Scope` | The lifecycle policy controlling instance lifetime and reuse during resolution cycles, such as transient (new instance per resolution) or singleton (cached single instance). |
| `Composition Root` | The isolated bootstrapping location within an application where all token bindings are wired into the container. Consuming domain logic does not interact with the container directly. |
| `Constructor-to-Tokens Mapping` | The explicit association mechanism linking constructor parameter positions to their corresponding tokens without relying on reflection metadata. |

---

## Non-goals

The library will not attempt to inspect class constructors via reflection, AST parsing, or source code decompilation. Any binding that resolves a class must rely on explicit, user-declared token associations.
