# Deployment, limitations, and roadmap

## Free two-host deployment

ARGUS separates the interface from the runtime:

- GitHub Pages serves the Vite-built static interface under `/ARGUS/`.
- A standalone Cloudflare Worker serves read APIs, D1-backed versioned data, protected operations, scheduled retention, and deterministic Aether.
- The Pages workflow pins the canonical public Worker URL as `VITE_ARGUS_API_URL`; the URL is public configuration, not a credential.
- The Worker accepts browser requests only from configured origins. Administrative routes are mounted but disabled without a server-side secret, and durable operations also require D1.

Before deployment:

1. Run lint, typecheck, unit tests, the Pages build, and `npm run brain:check`.
2. Provision D1, apply every reviewed migration through `0008_whole_gateway.sql`, add its `DB` binding, and store the bootstrap and GitHub OAuth values with Wrangler secrets.
3. Deploy the Worker with `npm run brain:deploy`, seed demonstration read models through the protected endpoint, and record its `workers.dev` URL.
4. Confirm the canonical Worker URL in `.github/workflows/deploy-pages.yml` and run the Pages workflow.
5. Keep `COLLECTOR_PILOT_ENABLED=false` until source credentials, queries, terms, and the protected queue have been reviewed.
6. Verify Worker CORS, the `X-ARGUS-Data-Store` header, globe/map tiles and attribution, `/api/health`, Aether fallback behavior, and demonstration labels.
7. Confirm no `.env`, credential, raw private evidence, or production database export is in either artifact.

GitHub Pages cannot execute REST handlers. The Worker imports the shared public handler functions directly, keeping validation and response behavior consistent without coupling the Vite site build to a server.

For production monitoring, deploy the collector scheduler/queue separately from interactive web traffic. Its runtime needs controlled outbound networking, durable cursors/jobs, source-specific secrets, dead-letter monitoring, and a D1 write service.

## Current limitations

- The GitHub Pages interface remains usable if the Worker is unavailable, but remote API features fall back to bundled demonstration behavior.
- GitHub OAuth, PKCE, stable analyst IDs, D1 sessions, role checks, audited role assignment, and browser review writes are implemented and configured on the public deployment. New deployments still require the documented one-time OAuth and administrator bootstrap.
- The admin bearer token remains bootstrap/recovery access and must be rotated and kept out of ordinary browser use.
- Protected-route and sign-in rate limits use D1 counters; higher-volume deployments should evaluate a Durable Object or gateway limiter.
- The three-source official collector pilot is implemented but globally disabled by default. Live runs persist only protected ingestion submissions and durable run health; they never publish automatically.
- Manual/API evidence intake is durable and review-gated. It does not fetch the submitted URL, and it remains explicitly demonstration-classified until the real-data release gate is satisfied.
- Retention and collector crons are configured. Fixed official endpoints use hardened Worker fetch; custom-source DNS pinning, high-volume queues, and optional Guardian/X credentials remain deployment responsibilities.
- RSS parsing is demonstration-grade and should be replaced by a hardened streaming parser.
- Claim extraction, contradiction detection, and classification are deterministic heuristics.
- Search covers provider events, reports, sources, briefs, watchlists, locations, and analyst notes; a separate entity index and full-text engine are not yet present.
- Aether is deterministic and has no live AI provider.
- The relationship, market, conflict, alert, camera, and playback datasets are fictional stored snapshots; no live provider is connected.
- The map supports globe and flat projections but has no terrain/elevation provider.
- Voice quality depends on browser SpeechSynthesis. Monitoring-wall layouts now use owner-aware D1 save/load for authenticated analysts and retain local storage only as an unsigned fallback.
- Map accuracy is limited to fixture coordinates; precision/provenance is not yet modeled.
- Browser notifications, report export, retention automation, and durable review/correction endpoints are implemented; broader backup/export and deletion workflows remain.

## Recommended next phases

### 1. Complete normalized durability — browser loop implemented

The D1 read-model provider, contract tests, versioned writes, optimistic conflict rejection, audit batches, protected audit pagination, owner-aware layouts, browser readback, retention, and explicit seed now exist. Events and relationships expose bounded page/limit pagination. Next, add cursor pagination for ingestion-scale collections and make normalized evidence/report tables authoritative during live ingestion rather than relying on materialized documents alone.

### 2. Identity and roles — implemented and deployed

GitHub OAuth with PKCE, stable analyst IDs, hashed D1 sessions, role checks, browser review writes, role-aware audits, last-administrator protection, and D1 rate limiting are implemented and live. Retain the shared bearer only for bootstrap and recovery.

### 3. Hardened ingestion runtime â€” review-gated intake implemented

The D1 intake queue, strict validation, normalized provenance, SHA-256 hashing, idempotent inserts, canonical duplicate quarantine, versioned reviewer decisions, attempt history, audit records, authenticated browser console, three fixed official source adapters, bounded streaming transport, durable cron runs, retries/dead letters, and source health telemetry are implemented. The pilot starts disabled and never enables publication. Next, add cursor persistence, controlled egress for user-configurable sources, and a Cloudflare Queue or Workflow only when measured volume justifies it.

### 4. Durable intelligence processing

Persist stage audits, evidence links, confidence history, contradiction queues, and correlation explanations. Evaluate thresholds on a lawful labeled corpus before expanding categories.

### 5. Retrieval and Aether provider

Build permission-scoped retrieval, structured output validation, citation reconciliation, model budgets, and a deterministic fallback. Treat generated analysis as a separate record type.

### 6. Operational hardening

Add backups, retention/deletion tools, dependency and secret scanning, abuse monitoring, accessibility tests, Playwright critical paths, load tests, disaster recovery, and privacy/ethical review.

## Release gate for real-world data

Do not remove the demonstration banner or ingest current events until durable attribution, identity/roles, audit transactions, secure egress, correction handling, retention policy, and operator review procedures are all working and tested. A visually complete dashboard is not sufficient operational readiness.
