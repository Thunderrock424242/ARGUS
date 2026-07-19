# Security and ethical OSINT

ARGUS handles hostile public content and potentially consequential analysis. Security and ethics are product requirements, not deployment polish.

## Implemented MVP controls

- Zod validation for all API queries and every administrative body
- Rejection of unknown write fields, oversized bodies, malformed JSON, and wrong media types
- Disabled-by-default administrative routes
- Bearer-token comparison through fixed-length SHA-256 digests and `timingSafeEqual`
- No-store safe JSON responses with credential-field redaction and generic internal errors
- Bounded administrative request limiting behind a replaceable store interface
- URL rules for credentials, schemes, local/private/link-local addresses, unsafe ports, and host allowlists
- Dry-run-only web collector execution; no request field can enable live mode
- Injected collector transport, redirect refusal, time/size caps, and address-verification hooks
- Append-ready audit records and a D1 audit adapter
- Worker CSP, anti-framing, no-sniff, referrer, permissions, cross-origin, and HTTPS transport headers
- Database checks, uniqueness constraints, foreign keys, and indexes
- React text rendering rather than untrusted `dangerouslySetInnerHTML`

Credential redaction is a last defense, not permission to put secrets in response objects. Raw feed payloads stay out of report list responses.

## SSRF and source URLs

Validation must happen when a source is proposed and again immediately before every network request. Resolve all addresses, reject if any answer is non-public, pin and verify the connected address, and repeat validation for every allowed redirect (the current policy rejects redirects). Block cloud metadata, loopback, private, carrier-grade NAT, link-local, multicast, documentation, unique-local IPv6, and IPv4-mapped variants. Use fixed host allowlists for official adapters.

The web API never accepts an arbitrary URL for immediate fetching. Source testing belongs in a queued worker with egress controls and an audit record.

## Authentication and authorization

The admin token is an MVP deployment switch, not full identity. Production should use Sites access controls or sign-in, bind actions to a stable user ID, and enforce roles server-side. Suggested roles are viewer, analyst, reviewer, source manager, and administrator. UI visibility is not authorization.

Rotate secrets, keep them in the hosting secret manager, and never use `NEXT_PUBLIC_` for credentials. Do not log authorization headers, source credentials, raw cookies, or full rejected request bodies.

## Content safety

Treat RSS XML, JSON, article text, filenames, Markdown, and Aether output as untrusted. Render plain text by default. If formatted content is later required, sanitize on the server with a conservative element/attribute allowlist and safe-link policy; do not rely on a CSP alone. Disable XML external entities and expansion. Bound nesting, decompressed size, item count, string length, and parser time.

## Ethical OSINT principles

ARGUS operators and contributors must:

- collect only publicly available, legally accessible information
- follow licenses, terms, robots directives where applicable, and rate limits
- preserve source attribution and original timestamps
- distinguish observed fact, reported claim, analysis, speculation, and analyst judgment
- describe confidence as evidence-rule coverage, never certainty
- avoid collecting or exposing private personal information
- avoid targeting private individuals or facilitating harassment
- minimize sensitive location and identity data
- preserve reviewable evidence with lawful retention controls
- record analyst changes and provide correction/rejection paths
- communicate collection gaps and contradictory reporting

Public availability does not automatically make collection ethical, necessary, or lawful. Apply purpose limitation and data minimization.

## Threat-driven production checklist

- Place admin routes behind identity-aware access and durable distributed rate limits.
- Implement a transactional writable provider with optimistic concurrency.
- Use a controlled egress proxy or equivalent DNS-pinning transport.
- Encrypt backups and sensitive fields; define retention and deletion schedules.
- Add dependency, secret, and migration scanning in CI.
- Monitor authorization failures, collector anomalies, audit write failures, and response-size violations without logging secrets.
- Test CSP against production map/tile endpoints and tighten `connect-src`/`img-src` hosts.
- Commission abuse-case, accessibility, and privacy reviews before live monitoring.
