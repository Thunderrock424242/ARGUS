# ARGUS architecture

ARGUS is organized around one central distinction: a **source report** is a single observation, bulletin, feed item, or article; an **intelligence event** is ARGUS's consolidated assessment of one developing situation. Reports remain attributable evidence. Events can change as evidence arrives without erasing report history.

## Runtime shape

| Layer | Location | Responsibility |
| --- | --- | --- |
| Browser entry and routes | `site/main.tsx` | Vite entry point, React Router route table, titles, and loading boundary |
| Application views | `app/` | Route components and reusable REST handler modules |
| Reusable interface | `components/` | Shell, command center, maps, dossiers, review, sources, Aether |
| Shared domain | `packages/shared/` | Types and explicitly fictional fixtures |
| Intelligence core | `packages/intelligence/` | Collection adapters, duplicate detection, correlation, claims, confidence, pipeline |
| Impact intelligence | `packages/intelligence/impact-engine.ts` and `market-impact.ts` | Deterministic consequence rules, graph chains, market anomaly scoring, and causal limits |
| Alert policy | `packages/intelligence/alert-manager.ts` | Priority queue, deduplication, cooldowns, acknowledgement, and bounded history |
| Provider boundary | `packages/database/provider.ts` and `d1-read-model-provider.ts` | Delegating read contract, immutable fallback, and versioned D1 implementation |
| Durable operations | `packages/database/durable-operations.ts` | D1 event/relationship review, alert, layout, seed, retention, history, and audit batches |
| Ingestion store | `packages/database/ingestion-store.ts` | Normalized intake, content hashing, idempotency, duplicate quarantine, review promotion, retry attempts, and audit batches |
| Durable schema | `db/` and `drizzle/` | D1 tables, constraints, indexes, and migration |
| Server policy | `lib/` | API validation, safe responses, admin auth, URL rules, rate limits, audit adapters |
| Public brain | `worker/index.ts` | Standalone read/Aether routing, D1 selection, GitHub Pages CORS, protected administration, and scheduled retention |

The API depends on `IntelligenceDataProvider`, not on fixture arrays or Drizzle queries directly. Route modules hold a stable delegating provider reference; the Worker points it at D1 before dispatch when `DB` exists. Immutable fixture fallback is conditional on `ARGUS_DEMO_ENABLED`; disabling it also filters already-seeded demonstration documents. A shared browser runtime provider hydrates events, reports, sources, relationships, histories, market data, and alerts from `/api/operations/snapshot`, then loads protected audit history for authorized reviewers. Its bundled fallback and demo-only screens are independently gated by `VITE_ARGUS_DEMO_ENABLED`.

Mutable read models expose their D1 `recordVersion` as response metadata inside the typed document while stripping it before JSON persistence. Review, relationship, alert, and layout writes require the loaded revision when supplied and use conditional versioned updates so stale browser state returns `409`. Monitoring layouts are prefixed and filtered by the authenticated stable owner ID.

Protected ingestion is a separate trust boundary. An Analyst or Source Manager may submit evidence; its protected provenance remains in `ingestion_submissions`, while a minimal public-information report is immediately visible in `reports` at a 25% `needs-review` ceiling. A Reviewer or Administrator may approve it, raising the default ceiling to 60%, or reject it, removing the public read model while preserving the protected record and audit reason. The intake stores normalized provenance and a SHA-256 content hash, protects client retries with a hashed idempotency key, tracks attempts in `ingestion_attempts`, and uses the submission version to prevent stale review or administrator confidence changes.

## Request flow

```text
GitHub Pages browser ----> static Vite interface
        |
        | HTTPS with restricted CORS
        v
Cloudflare Worker ----> reusable REST route
        |
        +-- Zod query or body validation
        +-- admin bearer check and rate limit when required
        |
        v
IntelligenceDataProvider ----> D1 versioned read models when bound
        |                       immutable fixture fallback otherwise
        v
Safe JSON response
```

Public reads and deterministic `/api/aether` are `no-store`. Report lists deliberately omit `rawPayload`. Administrative routes are mounted but disabled without the server-side token, and every durable mutation additionally requires D1. The static browser never receives the token.

The browser starts from immutable demonstration records and can hydrate the Global Operations surface from the Worker. Protected event/relationship reviews, alert actions, monitoring layouts, read-model seeding, and retention are durable D1 operations. GitHub OAuth with PKCE establishes stable identities, and the Worker authorizes D1-backed sessions and roles without exposing a shared secret.

## Collection and processing flow

Production scheduling is intentionally outside the web request lifecycle:

```text
Cron / queue -> collector job -> security-enforcing transport -> collected report
     -> validation -> normalization -> duplicate detection -> entity/location/category
     -> correlation -> claim candidates -> contradiction checks -> confidence
     -> transactional persistence -> review queues / maps / watchlists / briefs
```

The collector runtime executes one persistent job and returns an explicit retry or dead-letter outcome. It never creates an untracked `setInterval`. Network transport is injected so DNS pinning, egress controls, response-size limits, timeouts, redirect refusal, and per-source rate limits can be enforced in one place.

## Trust boundaries

- Feed and API content is hostile input even when the publisher is trusted.
- Aether output is analysis, never evidence, and may cite only stored report IDs.
- Automated confidence is rule coverage, not probability or verification.
- Analyst actions require authorization, strict schemas, and audit records.
- Browser code never receives collector secrets or the admin token.
- D1 constraints are the final defense for uniqueness, ranges, and relationships.

## Current versus planned

Current screens and data remain a fictional demonstration. D1-backed reads, versioned documents, audited write batches, scheduled retention, identity/roles, review-gated ingestion, globe mode, browser notifications, and Worker hydration are implemented. Live collector transport remains disabled while DNS-pinned outbound requests, strict parsers, queue scheduling, and source credentials are built.
