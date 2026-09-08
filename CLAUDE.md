# dockdi

Type-first dependency injection library for TypeScript, built on explicit branded tokens (phantom types) instead of decorators and `reflect-metadata`. Targets compile-time-safe dependency wiring without tooling gymnastics (no `tsconfig.json` flags, no `Reflect` polyfills) and with zero production dependencies.

---

## Knowledge base layout

| Path | Holds |
|---|---|
| `.claude/docs/` | Self-contained reference files, one concern each — vision, module reference, topology, persistence, mechanism reference, build approach |
| `.claude/rules/` | Conventions auto-loaded when a matching file is opened/edited, scoped via `paths:` frontmatter |
| `.claude/skills/` | This project's delta-workflow skills (`surveyor`, `specifier`, `archivist`, `sentinel`) |
| `.claude/settings.json` | Permission policy — see Permissions below |
| `libraries/<package>/deltas/` | Per-slice spec/design/plan files: `<slice>.spec.md`, optional `<slice>.design.md`, optional `<slice>.plan.md` — none exist yet, no slice has been specced |

This knowledge base governs `.claude/` only. The repo also carries a separate, independent harness under `.agents/` (with its own root `AGENTS.md`) for a different agent tool — the two are not kept in sync and edits to one don't imply the other.

## Repo layout

| Path | Purpose |
|---|---|
| `libraries/dockdi-ts/` | The core TypeScript package: library source, Bun-based dependency/lockfile management, `tsconfig.json` |
| `approach.md` | Root-level source of truth for the project's domain model, invariants, phased roadmap, and open risks/decisions |

The library source has not moved past an initial scaffold — no production DI mechanism is implemented yet.

## Setup & common commands

All commands run from inside the package directory (`libraries/dockdi-ts/`), which is the only real package in the repo today.

| Task | Command |
|---|---|
| Install dependencies | `bun install` |
| Run typecheck | `bun x tsc --noEmit` |

No `test`, `build`, or `lint` script is defined in the package manifest yet — don't invent one. Run source directly with `bun run` during prototyping until a real entry point and test suite exist.

## Permissions

The full policy lives in `.claude/settings.json`. Read-only git/inspection commands and web search are pre-approved; destructive git operations (`push`, `pull`) and reading `.env`/`secrets/**` are denied by default.

## Conventions

Project-wide invariants (zero decorators/`reflect-metadata`, zero production dependencies, synchronous-by-default resolution with async as an explicit opt-in) are each enforced via their own file under `.claude/rules/` rather than restated here — see that directory when touching library source or the package manifest.

---

## Non-goals

Property injection, decorator-based metadata extraction, and hierarchical/child containers are undecided-or-excluded for v1 — see `.claude/docs/approach.md` and `.claude/docs/overview.md` for the current scope boundary.
