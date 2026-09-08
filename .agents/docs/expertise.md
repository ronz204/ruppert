# Expertise

This document explains the technical mechanisms and runtime behaviors governing `dockdi`, specifically branded phantom types, decorator-free dependency binding, and resolution cycle detection.

---

## Glossary

| Term | Meaning |
|---|---|
| Branded Type | A compile-time pattern that attaches an artificial nominal identifier to a type, preventing accidental assignment between structurally identical types. |
| Phantom Type | A generic type variable that exists solely within TypeScript's static type checker and produces zero JavaScript runtime emission. |
| Composition Root | The sole bootstrapping point in an application where the dependency injection container is configured and bindings are established. |

## Branded Phantom Tokens

TypeScript uses a structural type system. By default, primitive types like `symbol` are interchangeable across variable assignments if their shapes match. To enforce that a token declared for `ServiceA` cannot be used to satisfy a parameter expecting `ServiceB`, `dockdi` brands the runtime `symbol`:

```typescript
declare const __brand: unique symbol;

export type Token<T> = symbol & {
  readonly [__brand]: T;
};
```

1. **Compile-time enforcement**: The `unique symbol` property key is never exported or assigned at runtime. TypeScript's compiler prevents passing `Token<ServiceA>` where `Token<ServiceB>` is required because their nominal brands disagree.
2. **Zero runtime overhead**: At runtime, `Token<T>` is a standard JavaScript `Symbol`. There are no wrapper objects, prototype lookups, or metadata dictionaries allocated in memory. Equality checks use standard reference comparison (`tokenA === tokenB`).

## Decorator-less Constructor Injection

Mainstream TypeScript inversion-of-control libraries rely on `reflect-metadata` alongside TypeScript compiler flags `experimentalDecorators` and `emitDecoratorMetadata`. When enabled, the compiler emits constructor parameter type metadata into the compiled JavaScript output.

This design introduces notable friction:
- Requires special compiler configuration flags in consumer `tsconfig.json`.
- Fails or behaves inconsistently with modern alternative transpilers (esbuild, SWC) that strip types without running full semantic analysis.
- Requires importing a global polyfill before application execution.

`dockdi` resolves constructor dependencies through explicit token associations. By passing explicit arrays or tuples of tokens corresponding to constructor arguments, TypeScript verifies parameter type alignment at compile-time while the runtime container resolves arguments positionally without inspection reflection.

## Resolution Graph Cycle Detection

Circular dependencies (e.g., component `A` requiring `B`, which requires `A`) cause infinite recursion and call-stack exhaustion if unhandled.

`dockdi` detects cycles during resolution graph traversal:
1. When resolving a token, the resolver verifies whether that token already exists in the active resolution call stack.
2. If the token is already in the stack, resolution halts immediately.
3. The resolver constructs a diagnostic error listing each token in the cycle sequence: `DatabaseService -> UserRepository -> DatabaseService`.
4. The token is removed from the active stack once all its dependencies have resolved successfully, permitting the same token to appear legitimately across independent branches of the dependency tree.

---

## Non-goals

This document does not cover external framework lifecycles or network serialization protocols.
