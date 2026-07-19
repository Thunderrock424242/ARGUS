# ARGUS

**Analysis and Reporting of Global Unfolding Situations**

ARGUS is a personal, public-information situational-awareness platform. It separates individual source reports from correlated intelligence events, exposes the evidence behind automated confidence, and gives a human analyst the final review authority. Its built-in analyst interface is called **Aether**.

> **Demonstration data — not real-world intelligence.** The bundled scenarios, organizations, people, identifiers, reports, and assessments are fictional. ARGUS is not affiliated with any intelligence service, military, law-enforcement body, emergency service, or government agency.

## What is included

- A dark, responsive command center, event explorer and dossiers
- A MapLibre global event map with filters and event previews
- Sources, review queues, watchlists, briefs, system health, and Aether surfaces
- 24 fictional events, 60+ reports, 15 sources, 10 watchlists, and 5 briefs
- Rule-based duplicate detection, event correlation, claim extraction, contradiction checks, and confidence scoring
- Network-free development collectors for RSS/Atom, USGS, NASA EONET, GDACS, ReliefWeb, NWS, CISA KEV, and GDELT
- Read-only REST APIs plus disabled-by-default administrative review and collector routes
- A Drizzle schema and migration for Cloudflare D1
- Vitest coverage for the intelligence core and API security boundaries

## Stack

Next.js App Router and React 19 run through vinext on Cloudflare Workers. TypeScript, Tailwind CSS, MapLibre GL, Recharts, Zod, Drizzle ORM, D1, Vitest, and Playwright provide the application, data, validation, and test layers.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The normal Next development server uses `npm run dev`; `npm run dev:sites` exercises the vinext/Cloudflare path. The default application is fully network-free and reads only fictional fixtures.

Useful verification commands:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Administrative API safety

`POST /api/admin/review` and `POST /api/admin/collectors/run` return `503 admin_disabled` unless `ARGUS_ADMIN_TOKEN` is set on the server. Send the configured value only as `Authorization: Bearer <token>`. Never put it in browser code, a URL, a committed file, a log, or an API response.

The current mock provider is immutable. Review requests are validated and audit-recorded in bounded process memory, then return `canonicalDataMutated: false`. Wire the included D1 audit adapter and a transactional writable provider before treating review actions as durable. Administrative collector requests are always `dry-run`; they cannot turn on network collection.

## REST endpoints

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
| POST | `/api/admin/review` | Protected, validated review/audit action |
| POST | `/api/admin/collectors/run` | Protected network-free collector exercise |

All API responses are `no-store`, carry a request ID, redact credential-shaped fields, and label fictional data. Unknown query and body fields are rejected.

## Documentation

- [Architecture](docs/architecture.md)
- [Local setup and environment](docs/getting-started.md)
- [D1, schema, and development data](docs/data-and-d1.md)
- [Collectors and RSS sources](docs/collectors.md)
- [Processing, correlation, and confidence](docs/intelligence-pipeline.md)
- [Analyst review workflows](docs/analyst-workflows.md)
- [Aether and map architecture](docs/aether-and-map.md)
- [Security and ethical OSINT](docs/security-and-ethics.md)
- [Deployment, limitations, and roadmap](docs/deployment-and-roadmap.md)

## Operating principle

ARGUS is an evidence organization and analysis tool, not an oracle. Automated confidence measures how much available evidence satisfies transparent rules; it is not mathematical probability, certainty, or a substitute for analyst judgment.
