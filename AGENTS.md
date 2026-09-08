# dockdi

Type-first dependency injection library for TypeScript based on explicit branded tokens (phantom types) instead of decorators and runtime reflection metadata. Delivers compile-time type safety with zero reflection overhead and zero production dependencies.

---

## Knowledge base layout

| Path | Holds |
|---|---|
| `.agents/docs/` | Self-contained technical reference documents (overview, approach, structure, modules, expertise, database) |
| `.agents/rules/` | Project conventions loaded conditionally based on file paths matching `paths:` glob patterns |
| `.agents/skills/` | Reusable skills for knowledge management and delta workflow (`surveyor`, `specifier`, `archivist`, `sentinel`) |
| `libraries/*/deltas/` | Per-slice specification, design, and roadmap documents (`<slice>.spec.md`, `<slice>.design.md`, `<slice>.plan.md`) |

## Repo layout

| Path | Purpose |
|---|---|
| `libraries/dockdi-ts/` | Core TypeScript package containing library source, Bun configuration, and test suites |
| `.agents/` | Agent harness containing project documentation, editing rules, and delta workflow skills |

## Setup & common commands

All development workflows operate through Bun within the target package directory (`libraries/dockdi-ts`):

| Task | Command |
|---|---|
| Install dependencies | `bun install` |
| Run tests | `bun test` |
| Run typecheck | `bun x tsc --noEmit` |

## Conventions

- Dependency injection is strictly token-driven via branded phantom types (`Token<T>`); decorators (`@inject`) and `reflect-metadata` are prohibited.
- Resolution execution is synchronous by default; asynchronous resolution is explicit and opt-in.
- Published library code maintains zero runtime dependencies.
- Changes to knowledge-base files under `.agents/` or delta contracts under `libraries/*/deltas/` route through `archivist` per `.agents/rules/delta-artifacts.md`.

---

## Non-goals

`dockdi` does not support property injection, decorator metadata extraction, or ambient global container locators.
