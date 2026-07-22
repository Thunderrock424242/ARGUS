# ARGUS

**Analysis and Reporting of Global Unfolding Situations**

ARGUS is a personal, public-information situational-awareness platform. It separates individual source reports from correlated intelligence events, exposes the evidence behind automated confidence, and gives a human analyst the final review authority. Its built-in analyst interface is called **Aether**.

The public demonstration is published at [thunderrock424242.github.io/ARGUS](https://thunderrock424242.github.io/ARGUS/).

> **Demonstration data — not real-world intelligence.** The bundled scenarios, organizations, people, identifiers, reports, and assessments are fictional. ARGUS is not affiliated with any intelligence service, military, law-enforcement body, emergency service, or government agency.

## What is included

- A dark, responsive command center, event explorer and dossiers
- An immersive Global Operations View with switchable MapLibre 3D globe and flat-map modes, live report stream, layer controls, alerts, and event previews
- An Orbital Watch with bounded Earth-orbit propagation, near-Earth approaches, Sentry monitoring context, solar events, source health, and a WebGL-independent table
- An evidence-linked relationship graph, multi-step impact chains, deterministic consequence rules, and analyst review controls
- Market-exposure assessments with separate anomaly, relationship, exposure, and causal-confidence scores
- Conflict and regional profiles, stored-state timeline playback, Aether voice alerts, a controlled camera registry, and a configurable monitoring wall
- Sources, review queues, watchlists, briefs, system health, and Aether surfaces
- 24 fictional events, 60+ reports, 15 sources, 10 watchlists, and 5 briefs
- Rule-based duplicate detection, event correlation, claim extraction, contradiction checks, and confidence scoring
- Network-free development collectors plus a disabled-by-default Worker pilot for USGS, The Guardian Open Platform, and X recent search
- Paginated read APIs plus identity-protected D1 review, audit, owner-layout, alert, seed, and retention routes
- A protected ingestion queue with provenance, SHA-256 content hashes, idempotent intake, duplicate quarantine, versioned review, retries, and canonical report approval
- A versioned D1 read-model provider, durable audit path, Drizzle schema, and migrations
- Vitest coverage for the intelligence core and API security boundaries

## Stack

Vite and React 19 produce the static site for GitHub Pages. React Router handles browser-side routes, while a separate Cloudflare Worker hosts the API, optional D1 data, and Aether “brain.” TypeScript, Tailwind CSS, MapLibre GL, Three.js, satellite.js, Recharts, Zod, Drizzle ORM, Vitest, and Playwright provide the application, data model, validation, and test layers.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The Vite development server runs the interface. Run `npm run brain:dev` in a second terminal when testing the standalone REST API and Aether Worker. The published interface is fully static and hydrates the Global Operations View from the Worker when `VITE_ARGUS_API_URL` is configured. Fictional fixture fallback is available only while `VITE_ARGUS_DEMO_ENABLED` is enabled.

Useful verification commands:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` writes the deployable GitHub Pages site to `dist/`. Pushes to `main` publish that directory through `.github/workflows/deploy-pages.yml`.

## Free hosting split

- **Site:** GitHub Pages serves the static interface at no application-server cost.
- **Brain:** Cloudflare Workers serves read APIs, deterministic Aether, scheduled retention, and a disabled-by-default official-source collector pilot.
- **Data:** the Worker selects D1 when a `DB` binding exists. Immutable fictional fixture fallback is available only when `ARGUS_DEMO_ENABLED=true`; disabling it also filters demonstration rows already stored in D1.

Validate and deploy the Worker with:

```powershell
npm run brain:check
npm run brain:deploy
```

The Pages workflow pins the public `https://argus-brain.thunderrock-labs.workers.dev` API origin. If the Worker name or subdomain changes, update `VITE_ARGUS_API_URL` in `.github/workflows/deploy-pages.yml` and rerun the workflow. Whenever the Worker is unavailable, Aether uses its bundled deterministic fallback so the site remains usable.

## Identity and administrative API safety

The Worker supports GitHub OAuth with PKCE, hashed short-lived D1 sessions, stable user IDs, explicit roles, and D1-backed rate limits. New identities receive `viewer`; reviewer, source-manager, and administrator permissions are granted through the audited role API. The public deployment has completed this bootstrap, while each additional deployment must follow [Identity and roles](docs/identity-and-roles.md).

Event reviews, relationship reviews, ingestion decisions, confidence adjustments, alert actions, monitoring layouts, read-model seeding, and retention operate on versioned D1 records and append audit/history entries. The ingestion queue normalizes and hashes evidence, rejects unsafe URLs, quarantines canonical duplicates, and immediately exposes new public-information reports at a 25% low-confidence ceiling. Reviewer approval raises the default ceiling to 60%; only administrators can set another value, and rejection removes the public read model while retaining the protected intake and audit reason. The allowlisted collector pilot uses fixed official hosts, refuses redirects, bounds response time and bytes, records retry/dead-letter state in D1, and can only write through that policy-controlled queue. Mutable actions carry the loaded D1 revision and reject stale edits instead of silently overwriting newer work; layouts are scoped to the stable signed-in owner ID. The browser sends only a short-lived ARGUS session; GitHub, Guardian, X, and bootstrap secrets never enter the Pages bundle. `ARGUS_ADMIN_TOKEN` remains command-line bootstrap/recovery access and must never be placed in `VITE_`, a URL, a committed file, a log, or a browser response.

## Public Worker endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/events` | Filtered, paginated events |
| GET | `/api/events/:slug` | Event dossier record |
| GET | `/api/reports` | Filtered reports without raw payloads |
| GET | `/api/sources` | Source and collector-health metadata |
| GET | `/api/briefs` | Filtered intelligence briefs |
| GET | `/api/briefs/:slug` | One intelligence brief |
| GET | `/api/search?q=...` | Cross-domain provider search |
| GET | `/api/health` | Safe provider and API health summary |
| GET | `/api/relationships` | Evidence-linked graph nodes, relationships, and history |
| GET | `/api/market-impacts` | Fictional asset exposure and anomaly assessments |
| GET | `/api/conflicts` | Conflict dossiers and country/regional profiles |
| GET | `/api/operations` | Global Operations counts and latest alerts |
| GET | `/api/operations/snapshot` | Hydration snapshot for the Global Operations View |
| GET | `/api/orbit` | Source-qualified orbital, close-approach, Sentry, and space-weather snapshot |

Identity endpoints include `GET /api/auth/config`, `POST /api/auth/exchange`, `GET /api/auth/session`, and `POST /api/auth/logout`. Protected Worker endpoints include event and relationship review, ingestion intake/list/review/retry, administrator confidence adjustment, collector status and controlled execution, alert and layout actions, demonstration seeding, retention, user listing, and role assignment.

These endpoints run under `npm run brain:dev` and are hosted by the standalone Worker, not at the GitHub Pages origin. Protected reads also include `GET /api/admin/audit`, `GET /api/admin/layouts`, `GET /api/admin/ingestion`, and `GET /api/admin/collectors`; `POST /api/admin/collectors/run` performs an authorized dry-run or sends an active pilot source into protected intake, and `POST /api/admin/orbit/sync` forces a bounded orbital refresh when live synchronization is enabled. All API responses are `no-store`, carry a request ID, and redact credential-shaped fields. Unknown query and body fields are rejected. Administrative handlers require both explicit server configuration and authorization.

## Documentation

- [Architecture](docs/architecture.md)
- [Local setup and environment](docs/getting-started.md)
- [D1, schema, and development data](docs/data-and-d1.md)
- [Identity and roles](docs/identity-and-roles.md)
- [Collectors and RSS sources](docs/collectors.md)
- [Processing, correlation, and confidence](docs/intelligence-pipeline.md)
- [Analyst review workflows](docs/analyst-workflows.md)
- [Aether and map architecture](docs/aether-and-map.md)
- [Orbital Watch implementation guide](docs/orbital-awareness.md)
- [Operations intelligence, impact, market, alerts, cameras, and playback](docs/operations-intelligence.md)
- [Security and ethical OSINT](docs/security-and-ethics.md)
- [Deployment, limitations, and roadmap](docs/deployment-and-roadmap.md)

## Operating principle

ARGUS is an evidence organization and analysis tool, not an oracle. Automated confidence measures how much available evidence satisfies transparent rules; it is not mathematical probability, certainty, or a substitute for analyst judgment.
