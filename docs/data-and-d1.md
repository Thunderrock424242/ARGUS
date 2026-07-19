# D1, database, and development data

## Provider boundary

Application code reads through `IntelligenceDataProvider`. Its current methods return events, one event by slug, reports, briefs, watchlists, and sources. `MockIntelligenceDataProvider` returns a fresh structured clone on every call, preventing a page or test from mutating canonical fixtures.

Production work should add a D1-backed implementation with equivalent read behavior plus an explicit write service. Do not add incidental writes to the read provider. Review, correlation, report insertion, confidence updates, and audit insertion should commit in one transaction or fail together where D1 capabilities permit.

## D1 binding and Drizzle

`.openai/hosting.json` declares the logical `DB` binding. Sites owns the actual Cloudflare resource and deployment wiring. `vite.config.ts` supplies a project-local placeholder for development; it is not a production database identifier.

The schema is in `db/schema.ts`, Drizzle configuration is in `drizzle.config.ts`, and generated migration SQL is under `drizzle/`. After an intentional schema edit:

```powershell
npm run db:generate
```

Review the SQL, constraints, delete behavior, indexes, and migration ordering before applying it. Never edit the migration journal casually after a migration has been deployed.

## Durable model

The schema includes:

- `intelligence_sources` and `source_reports`
- `intelligence_events` and event/report links
- claim records and supporting/contradicting report links
- confidence assessments with factor JSON
- analyst reviews and append-only audit logs
- collector runs and review queue items
- watchlists and intelligence briefs

Fields used for filtering and relationships remain typed columns; richer evolving assessments use JSON. Checks constrain severity and confidence. Unique indexes protect source URLs, event slugs, and source/external-ID pairs. Foreign keys state intentional cascade or restrict behavior.

## Audit persistence

`lib/audit/recorder.ts` provides two adapters:

- `MemoryAuditRecorder` is bounded and suitable only for development/tests.
- `D1AuditRecorder` targets the existing `audit_logs` table through a small structural D1 interface.

Before production review is enabled, inject `D1AuditRecorder` into the review service and use a writable event repository in the same server-side operation. The current route returns `durability: "process-memory"` and `canonicalDataMutated: false` so clients cannot mistake an accepted demo action for a durable decision.

## Development data

`packages/shared/demo-data.ts` supplies at least 24 events, 60 reports, 15 sources, 10 watchlists, and 5 briefs, plus timeline entries, audits, collector runs, contradictory claims, duplicates, confirmed events, and review-required events. It also validates cross-record relationships.

Every fixture must retain:

```text
Demonstration data — not real-world intelligence
```

Fixtures must never reuse a real breaking event, vulnerable person, operational unit, vessel, flight, or private identifier. The future seed command should refuse to seed a production environment unless an explicit demonstration flag is present.

## Production migration checklist

1. Provision Sites D1 and apply reviewed migrations.
2. Implement the D1 read provider and compare it against provider contract tests.
3. Implement idempotent report inserts keyed by source/external ID, canonical URL, and content hash.
4. Make event updates, evidence links, queue changes, and audits transactional.
5. Add cursor pagination and query indexes based on measured workloads.
6. Add backup/export, retention, correction, and deletion procedures.
7. Keep raw evidence access restricted and record every read or export that requires elevated permission.
