# Deployment, limitations, and roadmap

## Free two-host deployment

ARGUS separates the interface from the runtime:

- GitHub Pages serves the Vite-built static interface under `/ARGUS/`.
- A standalone Cloudflare Worker serves read APIs, D1-backed versioned data, protected operations, scheduled retention, and deterministic Aether.
- The Pages workflow pins the canonical public Worker URL as `VITE_ARGUS_API_URL`; the URL is public configuration, not a credential.
- The Worker accepts browser requests only from configured origins. Administrative routes are mounted but disabled without a server-side secret, and durable operations also require D1.

Before deployment:

1. Run lint, typecheck, unit tests, the Pages build, and `npm run brain:check`.
2. Provision D1, apply the reviewed migrations, add its `DB` binding, and store the bootstrap and GitHub OAuth values with Wrangler secrets.
3. Deploy the Worker with `npm run brain:deploy`, seed demonstration read models through the protected endpoint, and record its `workers.dev` URL.
4. Confirm the canonical Worker URL in `.github/workflows/deploy-pages.yml` and run the Pages workflow.
5. Keep collectors in dry-run for the public demonstration.
6. Verify Worker CORS, the `X-ARGUS-Data-Store` header, globe/map tiles and attribution, `/api/health`, Aether fallback behavior, and demonstration labels.
7. Confirm no `.env`, credential, raw private evidence, or production database export is in either artifact.

GitHub Pages cannot execute REST handlers. The Worker imports the shared public handler functions directly, keeping validation and response behavior consistent without coupling the Vite site build to a server.

For production monitoring, deploy the collector scheduler/queue separately from interactive web traffic. Its runtime needs controlled outbound networking, durable cursors/jobs, source-specific secrets, dead-letter monitoring, and a D1 write service.

## Current limitations

- The GitHub Pages interface remains usable if the Worker is unavailable, but remote API features fall back to bundled demonstration behavior.
- GitHub OAuth, PKCE, stable analyst IDs, D1 sessions, role checks, audited role assignment, and browser review writes are implemented; the live deployment still requires the OAuth App, secrets, migration, and Worker rollout.
- The admin bearer token remains bootstrap/recovery access and must be rotated and kept out of ordinary browser use.
- Protected-route and sign-in rate limits use D1 counters; higher-volume deployments should evaluate a Durable Object or gateway limiter.
- Administrative collector runs are deliberately dry-run and do not persist reports.
- Retention cron is configured, but live collector transport, DNS pinning, queues, and source credentials are not deployed.
- RSS parsing is demonstration-grade and should be replaced by a hardened streaming parser.
- Claim extraction, contradiction detection, and classification are deterministic heuristics.
- Search covers provider events, reports, sources, briefs, watchlists, locations, and analyst notes; a separate entity index and full-text engine are not yet present.
- Aether is deterministic and has no live AI provider.
- The relationship, market, conflict, alert, camera, and playback datasets are fictional stored snapshots; no live provider is connected.
- The map supports globe and flat projections but has no terrain/elevation provider.
- Voice quality depends on browser SpeechSynthesis, and the public monitoring-wall UI remains browser-local pending owner-aware save/load integration.
- Map accuracy is limited to fixture coordinates; precision/provenance is not yet modeled.
- Browser notifications, report export, retention automation, and durable review/correction endpoints are implemented; broader backup/export and deletion workflows remain.

## Recommended next phases

### 1. Complete normalized durability

The D1 read-model provider, contract tests, versioned writes, audit batches, retention, and explicit seed now exist. Next, add cursor pagination and make normalized evidence/report tables authoritative during live ingestion rather than relying on materialized documents alone.

### 2. Identity and roles — implemented, deployment setup pending

GitHub OAuth with PKCE, stable analyst IDs, hashed D1 sessions, role checks, browser review writes, role-aware audits, last-administrator protection, and D1 rate limiting are implemented. Complete the one-time OAuth configuration in `docs/identity-and-roles.md`; retain the shared bearer only for bootstrap and recovery.

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
