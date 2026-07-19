# Deployment, limitations, and roadmap

## Cloudflare Sites deployment

ARGUS uses vinext to produce a Cloudflare Worker-compatible application. `.openai/hosting.json` declares logical D1 binding `DB`; Sites provisions and injects the actual resource. The worker dispatches App Router traffic, serves image optimization, and adds security headers.

Before deployment:

1. Run lint, typecheck, unit tests, and the production build.
2. Review D1 migration SQL and apply it through the hosting workflow.
3. Configure `ARGUS_ADMIN_TOKEN` only if protected routes are intentionally needed.
4. Keep the mock provider and collectors in dry-run for a public demonstration.
5. Verify access policy, CSP, map tiles and attribution, health response, and demonstration labels.
6. Confirm no `.env`, credential, raw private evidence, or production database export is in the artifact.

For production monitoring, deploy the collector scheduler/queue separately from interactive web traffic. Its runtime needs controlled outbound networking, durable cursors/jobs, source-specific secrets, dead-letter monitoring, and a D1 write service.

## Current limitations

- The application provider is immutable fictional data; D1 is modeled but not wired for normal reads/writes.
- Review actions are validated and audit-recorded only in bounded process memory.
- Admin bearer auth is a deployment switch, not user identity or role-based authorization.
- The memory rate limiter is not distributed across Worker isolates.
- Administrative collector runs are deliberately dry-run and do not persist reports.
- Live transport, DNS pinning, queues, cron triggers, and source credentials are not deployed.
- RSS parsing is demonstration-grade and should be replaced by a hardened streaming parser.
- Claim extraction, contradiction detection, and classification are deterministic heuristics.
- Search covers provider events, reports, sources, briefs, watchlists, locations, and analyst notes; a separate entity index and full-text engine are not yet present.
- Aether is deterministic and has no live AI provider.
- Map accuracy is limited to fixture coordinates; precision/provenance is not yet modeled.
- Notifications, exports, retention automation, and durable correction workflows are not implemented.

## Recommended next phases

### 1. Durable read/write provider

Implement D1 provider contract tests, cursor pagination, transactional review commands, audit insertion, optimistic event versions, and explicit demo seeding. Make audit failure fail the write.

### 2. Identity and roles

Integrate the hosting identity layer, stable analyst IDs, role checks, CSRF protection if cookie-authenticated writes are added, and Durable Object or gateway rate limiting. Retire shared bearer access for ordinary review.

### 3. Hardened ingestion runtime

Deploy cron/queue scheduling, DNS-pinning egress, strict parsers, source allowlists, per-source limits, idempotent inserts, retries, dead letters, cursors, and health telemetry. Start with one official feed and a staged dry-run comparison.

### 4. Durable intelligence processing

Persist stage audits, evidence links, confidence history, contradiction queues, and correlation explanations. Evaluate thresholds on a lawful labeled corpus before expanding categories.

### 5. Retrieval and Aether provider

Build permission-scoped retrieval, structured output validation, citation reconciliation, model budgets, and a deterministic fallback. Treat generated analysis as a separate record type.

### 6. Operational hardening

Add backups, retention/deletion tools, dependency and secret scanning, abuse monitoring, accessibility tests, Playwright critical paths, load tests, disaster recovery, and privacy/ethical review.

## Release gate for real-world data

Do not remove the demonstration banner or ingest current events until durable attribution, identity/roles, audit transactions, secure egress, correction handling, retention policy, and operator review procedures are all working and tested. A visually complete dashboard is not sufficient operational readiness.
