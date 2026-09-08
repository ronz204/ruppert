# Database

This file covers persistence: data model and database infrastructure together. For dockdi, both sections are not applicable, stated explicitly below rather than left as an empty file.

---

## Not applicable

dockdi is an in-memory dependency injection library. A container's registered bindings and any resolved singleton instances live only in the process memory of the consuming application for the lifetime of that container — nothing is written to disk, to a database, or to any external store, and nothing survives a process restart. There is no data model to describe and no database engine, hosting, or backup/replication concern to record.

If a future phase introduces any form of persisted state (for example, caching resolved instances across process restarts), this file stops being not-applicable and should be filled with the real data model and infrastructure at that point.

---

## Non-goals

This file will never describe application-level data persisted by a *consumer* of dockdi — that data model belongs to the consuming application, not to this library.
