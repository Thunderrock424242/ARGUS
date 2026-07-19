# ARGUS architecture

ARGUS is organized around one central distinction: a **source report** is a single observation, bulletin, feed item, or article; an **intelligence event** is ARGUS's consolidated assessment of one developing situation. Reports remain attributable evidence. Events can change as evidence arrives without erasing report history.

## Runtime shape

| Layer | Location | Responsibility |
| --- | --- | --- |
| Application routes | `app/` | Server-rendered pages, client entry points, and REST handlers |
| Reusable interface | `components/` | Shell, command center, maps, dossiers, review, sources, Aether |
| Shared domain | `packages/shared/` | Types and explicitly fictional fixtures |
| Intelligence core | `packages/intelligence/` | Collection adapters, duplicate detection, correlation, claims, confidence, pipeline |
| Provider boundary | `packages/database/provider.ts` | Read contract and mock implementation |
| Durable schema | `db/` and `drizzle/` | D1 tables, constraints, indexes, and migration |
| Server policy | `lib/` | API validation, safe responses, admin auth, URL rules, rate limits, audit adapters |
| Edge entry | `worker/index.ts` | vinext request dispatch, image optimization, response security headers |

The UI and API depend on `IntelligenceDataProvider`, not on fixture arrays or Drizzle queries directly. The current provider is an immutable mock that returns structured clones. A D1 implementation can replace it without changing consumers.

## Request flow

```text
Browser or API client
        |
        v
Next App Router / REST route
        |
        +-- Zod query or body validation
        +-- admin bearer check and rate limit when required
        |
        v
IntelligenceDataProvider ----> mock fixtures today
        |                       D1 provider next
        v
Safe JSON response / React view
        |
        v
Worker security headers
```

Public REST routes are read-only and `no-store`. Report lists deliberately omit `rawPayload`. Administrative routes have a separate boundary and are unavailable unless a server-only token is configured.

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

Current screens and reads are a complete fictional demonstration. The D1 schema and migration exist, but the runtime provider still uses fixtures. Review actions record a bounded in-memory audit entry and explicitly report that canonical data was not mutated. Live collector adapters exist, but web-triggered runs are hard-coded to dry-run. These boundaries are intentional and must remain visible until a durable provider, identity/roles, and a hardened outbound transport are deployed.
