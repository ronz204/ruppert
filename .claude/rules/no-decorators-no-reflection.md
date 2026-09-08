---
paths:
  - "libraries/dockdi-ts/source/**"
---

# No Decorators / No Reflection Conventions

Applies to the library's own source. Downstream consumers are free to use decorators in their own code — this rule only governs code shipped as part of dockdi itself.

---

## Constructor injection only, no decorator metadata

- Never introduce decorator syntax (e.g. an `@inject`-style annotation) anywhere in library source, because dockdi's entire design premise is that dependency wiring is verifiable through TypeScript's static type system alone — a decorator-based path reintroduces the exact runtime-metadata dependency this project exists to avoid.
- Never import or depend on a reflection-metadata library, even as an optional/opt-in code path, because "optional" reflection still requires the compiler flags and runtime polyfill this project is committed to not requiring of any consumer.
- Prefer solving a constructor-to-token association problem through the type system or an explicit, type-checked declaration, not through inspecting a class's constructor at runtime — runtime inspection is exactly the mechanism being deliberately avoided.

---

## Non-goals

Doesn't restrict how a *consuming* application wires its own classes — a consumer may use decorators for unrelated purposes (e.g. a web framework's own routing decorators) without violating this rule, since this rule only governs code inside the library itself.
