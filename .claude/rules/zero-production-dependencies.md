---
paths:
  - "libraries/dockdi-ts/package.json"
---

# Zero Production Dependencies Conventions

Applies to the package manifest for dockdi's own library package.

---

## No runtime dependencies without explicit justification

- Never add an entry under the package manifest's runtime `dependencies` without first surfacing it to the user and getting explicit sign-off, because dockdi's committed differentiator is a published package with zero runtime dependencies — a single unnoticed addition silently breaks that guarantee for every consumer who installs it.
- A `devDependency` (tooling, types, test runner) or a `peerDependency` (something the consumer is expected to already provide, e.g. TypeScript itself) is not covered by this restriction — only entries that would actually ship and be installed transitively with the published package are in scope.
- If a feature seems to need a runtime dependency, treat that as a signal to reconsider the feature's design or scope before reaching for the dependency, not as a routine trade-off to accept.

---

## Non-goals

Doesn't apply to any other package's manifest in the repository — only to the manifest of the library actually published as dockdi.
