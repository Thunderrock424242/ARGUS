# ARGUS

**Analysis and Reporting of Global Unfolding Situations**

ARGUS is a personal, public-information situational-awareness platform. It separates individual source reports from correlated intelligence events, exposes the evidence behind automated confidence, and gives a human analyst the final review authority. Its built-in analyst interface is called **Aether**.

The public demonstration is published at [thunderrock424242.github.io/ARGUS](https://thunderrock424242.github.io/ARGUS/).

> **Demonstration data — not real-world intelligence.** The bundled scenarios, organizations, people, identifiers, reports, and assessments are fictional. ARGUS is not affiliated with any intelligence service, military, law-enforcement body, emergency service, or government agency.

## What is included

- A dark, responsive command center, event explorer and dossiers
- An immersive Global Operations View with switchable MapLibre 3D globe and flat-map modes, live report stream, layer controls, alerts, and event previews
- An evidence-linked relationship graph, multi-step impact chains, deterministic consequence rules, and analyst review controls
- Market-exposure assessments with separate anomaly, relationship, exposure, and causal-confidence scores
- Conflict and regional profiles, stored-state timeline playback, Aether voice alerts, a controlled camera registry, and a configurable monitoring wall
- Sources, review queues, watchlists, briefs, system health, and Aether surfaces
- 24 fictional events, 60+ reports, 15 sources, 10 watchlists, and 5 briefs
- Rule-based duplicate detection, event correlation, claim extraction, contradiction checks, and confidence scoring
- Network-free development collectors for RSS/Atom, USGS, NASA EONET, GDACS, ReliefWeb, NWS, CISA KEV, and GDELT
- Read APIs plus disabled-by-default, token-protected D1 administrative review, layout, alert, seed, and retention routes
- A versioned D1 read-model provider, durable audit path, Drizzle schema, and migrations
- Vitest coverage for the intelligence core and API security boundaries

## Stack

Vite and React 19 produce the static site for GitHub Pages. React Router handles browser-side routes, while a separate Cloudflare Worker hosts the API, optional D1 data, and Aether “brain.” TypeScript, Tailwind CSS, MapLibre GL, Recharts, Zod, Drizzle ORM, Vitest, and Playwright provide the application, data model, validation, and test layers.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The Vite development server runs the interface. Run `npm run brain:dev` in a second terminal when testing the standalone REST API and Aether Worker. The published interface is fully static and starts from fictional fixtures, then hydrates the Global Operations View from the Worker when `VITE_ARGUS_API_URL` is configured. It keeps the bundled fallback if that Worker is unavailable.

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
- **Brain:** Cloudflare Workers serves read APIs, deterministic Aether, scheduled retention, and disabled-by-default administrative routes.
- **Data:** the Worker selects D1 when a `DB` binding exists and otherwise uses immutable fictional fixtures. Empty or unavailable D1 collections fall back independently, so a first deployment remains usable.

Validate and deploy the Worker with:

```powershell
npm run brain:check
npm run brain:deploy
```

After the first Worker deployment, create the GitHub repository variable `ARGUS_API_URL` with the resulting `https://...workers.dev` URL and rerun the Pages workflow. Until that variable is set—or whenever the Worker is unavailable—Aether uses its bundled deterministic fallback so the site remains usable.

## Identity and administrative API safety

The Worker supports GitHub OAuth with PKCE, hashed short-lived D1 sessions, stable user IDs, explicit roles, and D1-backed rate limits. New identities receive `viewer`; reviewer, source-manager, and administrator permissions are granted through the audited role API. See [Identity and roles](docs/identity-and-roles.md) for setup.

Event reviews, relationship reviews, alert actions, monitoring layouts, read-model seeding, and retention operate on versioned D1 documents and append audit/history records. The browser sends only a short-lived ARGUS session; GitHub and bootstrap secrets never enter the Pages bundle. `ARGUS_ADMIN_TOKEN` remains command-line bootstrap/recovery access and must never be placed in `VITE_`, a URL, a committed file, a log, or a browser response. Administrative collector requests remain `dry-run`; they cannot turn on network collection.

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

Identity endpoints include `GET /api/auth/config`, `POST /api/auth/exchange`, `GET /api/auth/session`, and `POST /api/auth/logout`. Protected Worker endpoints include event and relationship review, alert and layout actions, dry-run collector execution, demonstration seeding, retention, user listing, and role assignment.

These endpoints run under `npm run brain:dev` and are hosted by the standalone Worker, not at the GitHub Pages origin. All API responses are `no-store`, carry a request ID, redact credential-shaped fields, and label fictional data. Unknown query and body fields are rejected. Administrative handlers require both explicit server configuration and authorization.

## Documentation

- [Architecture](docs/architecture.md)
- [Local setup and environment](docs/getting-started.md)
- [D1, schema, and development data](docs/data-and-d1.md)
- [Identity and roles](docs/identity-and-roles.md)
- [Collectors and RSS sources](docs/collectors.md)
- [Processing, correlation, and confidence](docs/intelligence-pipeline.md)
- [Analyst review workflows](docs/analyst-workflows.md)
- [Aether and map architecture](docs/aether-and-map.md)
- [Operations intelligence, impact, market, alerts, cameras, and playback](docs/operations-intelligence.md)
- [Security and ethical OSINT](docs/security-and-ethics.md)
- [Deployment, limitations, and roadmap](docs/deployment-and-roadmap.md)

## Operating principle

ARGUS is an evidence organization and analysis tool, not an oracle. Automated confidence measures how much available evidence satisfies transparent rules; it is not mathematical probability, certainty, or a substitute for analyst judgment.
