# Modules

This document provides the per-component functional specification, execution flows, and data contracts for `dockdi`.

---

## `Token`

**Purpose.** Factory and branded type construct generating unique, type-safe dependency identifiers at runtime with zero overhead.

**Flow.**
1. The consumer invokes the token creation function with an optional description string.
2. The runtime creates a unique `Symbol(description)`.
3. The symbol is cast to a branded type carrying compile-time type parameter `T`.
4. The token is returned as an immutable reference usable in binding and resolution calls.

**Data shape.**
```typescript
declare const __brand: unique symbol;

export type Token<T> = symbol & {
  readonly [__brand]: T;
};
```

## `Binding`

**Purpose.** Encapsulates the strategy and lifecycle configuration associated with a token in the container registry.

**Flow.**
1. Created via the fluent binding builder exposed by `Container.bind(token)`.
2. Stores the resolution strategy (`toClass`, `toFactory`, `toValue`), parameter token dependencies, and assigned scope.
3. Consumed by the resolver to instantiate or retrieve instances.

**Data shape.**
```typescript
export type BindingType = "class" | "factory" | "value";
export type ScopeType = "transient" | "singleton" | "resolution";

export interface Binding<T> {
  readonly type: BindingType;
  readonly scope: ScopeType;
  readonly provider: unknown;
  readonly dependencies?: readonly Token<unknown>[];
}
```

## `Container`

**Purpose.** Central registration and resolution facade orchestrating binding maps and dispatching requests to the resolver engine.

**Flow.**
1. Initialization creates an empty token-to-binding registry and a singleton instance cache.
2. `bind(token)` returns a builder to register class, factory, or value bindings.
3. `get(token)` delegates to the resolver, returning the resolved instance `T` synchronously.
4. `resolveAsync(token)` delegates to the resolver for asynchronous resolution pipelines.

**Data shape.**
```typescript
export interface Container {
  bind<T>(token: Token<T>): BindingBuilder<T>;
  get<T>(token: Token<T>): T;
  resolveAsync<T>(token: Token<T>): Promise<T>;
}
```

## `Resolver`

**Purpose.** Core graph traversal engine that resolves dependencies, tracks resolution call stacks, detects cycles, and enforces scoping policies.

**Flow.**
1. Receives the requested token and active resolution context.
2. Checks whether the token exists in the active resolution stack; if present, aborts immediately with a circular dependency diagnostic error detailing the cycle chain.
3. Pushes the token to the resolution stack.
4. Checks the instance cache if the binding specifies singleton scope; returns cached reference if found.
5. If dependencies are declared, recursively resolves each child dependency token.
6. Instantiates the target class or evaluates the factory using the resolved child instances.
7. Stores the result in the instance cache if singleton-scoped.
8. Pops the token from the resolution stack and returns the constructed instance.

**Data shape.**
```typescript
export interface ResolutionContext {
  readonly activeStack: Token<unknown>[];
  readonly singletonCache: Map<Token<unknown>, unknown>;
}
```

---

## Non-goals

Components will not provide JSON serialization or deserialization of registered container graphs, and will not support runtime mutation of existing bindings once the container is sealed.
