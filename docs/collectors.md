# Collectors, schedules, and RSS sources

## Collector contract

An `IntelligenceCollector` has an ID, display name, source type, and one `collect(context)` method. The context carries the configured source, request ID, collection time, optional cursor/since values, abort signal, and no ambient credentials. A collector returns normalized `CollectedReport` candidates; it does not write directly to the database. The trusted runtime must pass each candidate through the same `createIngestionSubmission` boundary used by manual/API intake.

Included adapters cover RSS/Atom, USGS Earthquake GeoJSON, NASA EONET, GDACS, ReliefWeb, National Weather Service alerts, CISA Known Exploited Vulnerabilities, and GDELT discovery data. They default to `dry-run` and emit labeled synthetic output without network access.

## Production execution

Use platform cron or a persistent queue to create collector jobs. `executeCollectorJob` runs exactly one job and returns a collector run plus a retry job or dead-letter outcome. Exponential backoff is bounded and jitter-ready. Store jobs, cursors, last-success timestamps, and dead letters durably; never rely on `setInterval` inside a web process. ARGUS now has durable ingestion submissions and attempt history, but the production collector queue, consumer, and dead-letter binding are not deployed yet.

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

This layered process is required to resist DNS rebinding and cloud-metadata access. Syntax-only validation is not sufficient for a live request.

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
