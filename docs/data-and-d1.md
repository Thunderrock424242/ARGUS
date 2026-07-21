# D1, database, and development data

## Provider boundary

Application code reads through `IntelligenceDataProvider`. `MockIntelligenceDataProvider` returns a fresh structured clone on every call, preventing a page or test from mutating canonical fixtures. `D1IntelligenceDataProvider` reads complete versioned documents from `intelligence_read_models`; per-collection fixture fallback occurs only while demonstration mode is enabled.

Reads remain separate from `durable-operations.ts`. Event and relationship reviews, ingestion decisions, alert actions, layout saves, historical snapshots, and audit records use D1 batch operations. A failed batch does not return a successful analyst decision.

## D1 binding and Drizzle

The GitHub Pages frontend has no database binding. The Worker automatically uses D1 when its environment contains a `DB` binding; otherwise it retains the immutable mock provider. Do not place a database identifier, administrator token, or credential in the frontend.

The schema is in `db/schema.ts`, Drizzle configuration is in `drizzle.config.ts`, and generated migration SQL is under `drizzle/`. After an intentional schema edit:

```powershell
npm run db:generate
```

Review the SQL, constraints, delete behavior, indexes, and migration ordering before applying it. Never edit the migration journal casually after a migration has been deployed.

Provision and initialize a new remote database with the current migration files:

```powershell
npx wrangler d1 create argus-intelligence
# Add the returned DB binding to wrangler.jsonc with migrations_dir "drizzle",
# then apply every pending reviewed migration in journal order:
npx wrangler d1 migrations apply argus-intelligence --remote
npx wrangler secret put ARGUS_ADMIN_TOKEN
```

The existing ARGUS production database predates migration tracking: files `0000` through `0003` were applied with `wrangler d1 execute`. Before its first tracked migration, run `scripts/baseline-existing-d1-migrations.sql` once as described in [Identity and roles](identity-and-roles.md). Always list pending remote migrations and verify the names before applying them.

When demonstration mode is enabled, call `POST /api/admin/demo-seed` once with the bearer token, a reviewer name, and `confirmation: "seed-demonstration-data"`. The seed is idempotent and updates versions on subsequent runs. When `ARGUS_DEMO_ENABLED=false`, the route returns `demo_disabled`, existing demonstration read models are filtered from API reads, and no fixture fallback is used; the flag does not delete stored rows.

## Durable model

The schema includes:

- `intelligence_sources` and `source_reports`
- `intelligence_events` and event/report links
- claim records and supporting/contradicting report links
- confidence assessments with factor JSON
- analyst reviews and append-only audit logs
- collector runs with durable schedule/attempt/retry state and review queue items
- normalized ingestion submissions and append-only attempt records
- watchlists and intelligence briefs
- versioned materialized API documents used by the Worker
- GitHub identities, roles, hashed sessions, and durable rate-limit counters

Fields used for filtering and relationships remain typed columns; richer evolving assessments use JSON. Checks constrain severity and confidence. Unique indexes protect source URLs, event slugs, and source/external-ID pairs. Foreign keys state intentional cascade or restrict behavior.

## Audit persistence

`lib/audit/recorder.ts` provides two adapters:

- `MemoryAuditRecorder` is bounded and suitable only for development/tests.
- `D1AuditRecorder` targets the existing `audit_logs` table through a small structural D1 interface.

Protected Worker review routes return durable success only after their versioned target and audit/history records succeed. Public-information ingestion creates a pending report at 25% confidence in the same D1 batch as the protected intake. Approval promotes it to `analyst-confirmed` and at least 60%; rejection deletes the public read model while retaining the protected submission and reason. Administrator confidence overrides use their own permission, optimistic version check, and audit action. The older memory recorder remains available solely for isolated service tests.

## Development data

`packages/shared/demo-data.ts` supplies at least 24 events, 60 reports, 15 sources, 10 watchlists, and 5 briefs, plus timeline entries, audits, collector runs, contradictory claims, duplicates, confirmed events, and review-required events. It also validates cross-record relationships.

Every fixture must retain:

```text
Demonstration data — not real-world intelligence
```

Fixtures must never reuse a real breaking event, vulnerable person, operational unit, vessel, flight, or private identifier. The seed command refuses to run when the deployment demonstration flag is disabled.

## Production migration checklist

1. Provision a D1 database for the standalone Worker and apply reviewed migrations.
2. Seed or ingest records and verify the `X-ARGUS-Data-Store: d1` response header.
3. Route live collectors through the implemented idempotent ingestion service instead of writing reports directly.
4. Extend approved submissions into normalized report/evidence link tables in addition to the current canonical read model.
5. Add cursor pagination and query indexes based on measured workloads.
6. Add backup/export, retention, correction, and deletion procedures.
7. Keep raw evidence access restricted and record every read or export that requires elevated permission.
