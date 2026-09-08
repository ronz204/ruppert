# Expertise

This file explains how the non-trivial mechanisms dockdi's design depends on actually work — not whether or where they're used, which is structure.md's and overview.md's job.

---

## Glossary

| Term | Meaning |
|---|---|
| Phantom type | A type parameter that exists only in a type's static signature and has no corresponding runtime representation or storage — used to carry compile-time information on a value that is otherwise runtime-identical to a simpler type. |
| Branded type | A type produced by attaching a phantom type (or a similar nominal marker) to an otherwise structural type, so the type checker treats two values with the same runtime shape as distinct types. |

## Branded tokens (phantom types)

TypeScript's type system is structural: two types with the same shape are interchangeable, even when they represent conceptually different things. A branded token attaches a phantom type parameter to a runtime value (a `Symbol`) so that, at compile time, two tokens intended for different types are treated as distinct and incompatible — the compiler will reject supplying the wrong token where a specific type is expected.

This guarantee is compile-time only. At runtime, a branded token has no memory or behavior beyond what its underlying value already had — the phantom type parameter is erased entirely by the compiler and contributes nothing to how the token behaves, compares, or serializes once the program is running. Reasoning about a token's type therefore always requires the static type checker; nothing about a token's runtime representation reveals what type it was branded with. This is also why the approach costs nothing extra at runtime compared to using a plain unique value directly — the safety is bought entirely at compile time.

## Constructor-to-token mapping without reflection

A DI container that resolves a class by inspecting its constructor needs to know, for each constructor parameter, which token should supply it. Runtime reflection metadata (attached via decorators) can answer this by inspecting a class's own metadata at resolution time — automatically, without a second declaration.

Without reflection, that information has to come from somewhere else, and the mechanisms available all share the same underlying constraint: TypeScript's type information does not exist at runtime, so nothing about a constructor's parameter types is inspectable once compiled. The alternative most reflection-free containers converge on is a separate, explicit declaration — a list of tokens supplied alongside the class, in the same order as its constructor parameters. This works, but it introduces a real failure mode: the declared list and the actual constructor signature are two independent pieces of code that must be kept in sync by hand, and nothing catches the two silently drifting apart (a reordered constructor parameter, an added parameter with no matching token added to the list) until the mismatch manifests as a wrong value at runtime, not a compile error.

This is the specific gap dockdi's central open design question is trying to close: whether a token-driven design can associate constructor parameters with tokens in a way the compiler itself can verify stays in sync, rather than accepting the separately-maintained-list failure mode as unavoidable.

---

## Non-goals

This file does not evaluate or compare full DI framework feature sets — only the specific mechanisms (phantom types, reflection-free constructor mapping) this project's own design depends on.
