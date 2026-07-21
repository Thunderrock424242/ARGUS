# Collectors, schedules, and RSS sources

## Collector contract

An `IntelligenceCollector` has an ID, display name, source type, and one `collect(context)` method. The context carries the configured source, request ID, collection time, optional cursor/since values, abort signal, and no ambient credentials. A collector returns normalized `CollectedReport` candidates; it does not write directly to the database. The trusted runtime must pass each candidate through the same `createIngestionSubmission` boundary used by manual/API intake.

Included adapters cover RSS/Atom, USGS Earthquake GeoJSON, The Guardian Open Platform, X recent search, NASA EONET, GDACS, ReliefWeb, National Weather Service alerts, CISA Known Exploited Vulnerabilities, and GDELT discovery data. They default to `dry-run` and emit labeled synthetic output without network access.

## Production execution

The Worker pilot uses a 15-minute UTC Cron Trigger. `executeCollectorJob` runs exactly one job and returns a collector run plus a retry or dead-letter outcome. Runs, attempts, the next retry time, source health, and last-success timestamps are durable in D1; no `setInterval` or module-global request state is used. A higher-volume rollout should move fan-out to Cloudflare Queues or Workflows, but the three-source pilot remains a bounded single-step cron task.

The active pilot registry is intentionally small:

| Source | Role | Credential | Publication rule |
| --- | --- | --- | --- |
| [USGS Earthquake GeoJSON](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | Official structured signal | None | Protected intake only |
| [The Guardian Open Platform](https://open-platform.theguardian.com/documentation/) | News report | `GUARDIAN_API_KEY` | Metadata/excerpt only; protected intake only |
| [X recent search](https://docs.x.com/x-api/posts/search/quickstart/recent-search) | Unverified social signal | `X_BEARER_TOKEN` | Never independent confirmation; protected intake only |

The Guardian adapter does not store full article bodies. The X adapter preserves a Post link and author handle, but analyst review and independent corroboration remain mandatory. The [X API uses pay-per-use pricing](https://docs.x.com/x-api/getting-started/pricing), so it is opt-in and not part of the free default. Source access, quotas, and terms must be checked before activation.

Suggested schedules are starting points, not promises:

| Source class | Initial cadence |
| --- | --- |
| Earthquakes and emergency alerts | 5 minutes |
| Source-health checks | 10 minutes |
| Discovery APIs | 15 minutes |
| RSS/Atom | 15–30 minutes |
| Humanitarian and slower official feeds | hourly |
| Developing-event recheck | hourly or evidence-triggered |

Honor publisher limits over these defaults. Add randomized scheduling where permitted to prevent synchronized bursts.

## Outbound request security

Collector URLs are hostile even when submitted by an administrator. `lib/security/public-url.ts` rejects invalid, credentialed, non-HTTP(S), local, private, link-local, single-label, unsafe-port, and disallowed-host URLs. A production transport must also:

1. Resolve all A and AAAA answers and reject the target if any is non-public.
2. Pin the approved address for the connection and verify the connected address.
3. Re-resolve on a later job; never trust a permanent validation result.
4. Reject redirects, or re-run the complete policy on every redirect hop.
5. Enforce HTTPS/host allowlists for fixed official adapters.
6. Set connection/read timeouts and a maximum compressed and decompressed size.
7. Restrict response content types and parse defensively.
8. Route egress through a controlled network policy where possible.

Cloudflare Workers does not expose the connected origin IP to JavaScript, so its native `fetch` cannot implement application-level DNS pinning. The deployed pilot therefore permits only three compile-time official host/path pairs, removes caller-supplied authorization, injects secrets server-side, rejects every redirect, validates content type, streams into a hard byte cap, and applies a timeout. Arbitrary/custom RSS collection remains dry-run until a transport with address verification or controlled egress is added. Syntax-only validation is not sufficient for a user-configurable live request.

## Enabling the Worker pilot

1. Apply D1 migrations `0007_young_sheva_callister.sql` and `0008_whole_gateway.sql`.
2. Obtain a Guardian Open Platform developer key if Guardian collection is required.
3. Obtain approved X developer access and a Bearer Token if X collection is required. The X API is currently pay-per-use, so `COLLECTOR_X_ENABLED` defaults to `false`; leaving it disabled does not affect USGS or Guardian.
4. Run `npx wrangler secret put GUARDIAN_API_KEY` and/or `npx wrangler secret put X_BEARER_TOKEN` from the repository root.
5. Review the two query strings in `wrangler.jsonc` and keep the X query specific.
6. Set `COLLECTOR_PILOT_ENABLED` to `true`. Individual source flags remain independent.
7. Run `npm run brain:check`, then `npm run brain:deploy`.
8. Sign in as Source Manager or Administrator, open **Ingestion**, inspect the Collector Pilot panel, and run one source manually.
9. Review the submitted reports. They enter the public read model at 25% confidence with `needs-review`; approval raises the default ceiling to 60%, rejection removes the public record, and only administrators can make a separately audited override.

## Adding an RSS or Atom source

1. Confirm the feed is public, lawful to collect, and covered by publisher terms.
2. Record publisher, canonical feed URL, attribution, license, categories, region, schedule, reliability rationale, limitations, and independence group.
3. Run URL syntax and DNS/address policy checks server-side.
4. Fetch once through the hardened transport with redirects disabled.
5. Verify `Content-Type`, byte limit, RSS/Atom structure, item timestamps, stable IDs, and canonical links.
6. Start disabled or in dry-run, inspect parsed reports, then enable through an audited action.
7. Monitor failures and stop automatically after a bounded threshold.

Never accept HTML pasted from a feed as trusted markup. The current adapter converts XML fragments to plain text for demonstration; production should use a hardened XML parser with entity expansion disabled and an allowlist sanitizer if any markup must be retained.

## Adding a collector

Implement `IntelligenceCollector`, keep transport injection, define a fixed allowlist for official APIs, cap records and bytes, normalize timestamps to ISO 8601, retain attributable raw payloads server-side, and return stable external IDs when available. Add parser fixtures, failure tests, URL/redirect tests, rate-limit behavior, license notes, and a dry-run scenario before registering it in `createDefaultCollectors`.

## Rate limiting

`RateLimitStore` and `FixedWindowRateLimiter` separate policy from storage. The memory store remains limited to isolated tests. Protected Worker routes use the D1 rate-limit store and stable session identity; a higher-volume rollout should evaluate Durable Objects or a managed gateway. Per-user admin limits and per-source outbound limits are separate controls; neither replaces the other.
