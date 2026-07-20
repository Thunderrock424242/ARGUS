# Operations intelligence, impact, and alerts

ARGUS extends its event/report distinction with a typed intelligence graph. The implementation remains an explicitly fictional, deterministic demonstration. It does not collect live financial data, infer real-world conflict outcomes, or claim that temporal correlation proves causation.

## Graph and impact model

`packages/shared/types.ts` defines graph nodes, relationships, per-link history, impact rules, market assessments, conflicts, regional profiles, historical state changes, alerts, cameras, and monitoring layouts. Demonstration records live separately in `packages/shared/operations-demo-data.ts`.

Every `IntelligenceRelationship` preserves:

- typed source and target nodes
- a relationship label and review state
- relationship, exposure, causal, and optional market-anomaly scores
- supporting and contradicting report identifiers
- a human-readable explanation
- detection method, model version, and recalculation time
- analyst notes and state

The visual graph uses solid, dashed, and dotted edge treatments as well as labels so meaning is not communicated through color alone. Multi-step chains keep each edge intact; ARGUS never replaces a chain with one averaged score.

## Deterministic relationship engine

`packages/intelligence/impact-engine.ts` evaluates enabled `ImpactRule` records against events and typed targets. Rules can constrain category, keywords, severity, state, geography, and target types. Confidence adjustments use explicit corroboration, official-source, severity, and contradiction signals.

Every automatically generated consequence is marked `needs-review`, carries the note `Hypothesis — analyst review required`, and caps causal confidence at 45. Recalculation appends a history record instead of erasing the previous state. Trusted administrative clients can use the protected D1 event and relationship review routes, which version the updated document and append history plus audit records in one batch.

## Market impact

`packages/intelligence/market-impact.ts` compares asset movement with normal volatility, volume, sector, index, and broader-market movement. It returns separate values for:

- exposure confidence
- relationship confidence
- market anomaly score
- causal confidence

The engine can identify unusual movement without asserting cause. Timing and modeled exposure cannot by themselves push causal confidence above the conservative cap. Demonstration symbols and prices are fictional and do not represent tradable assets.

## Historical playback

`IntelligenceStateChange` stores event, relationship, market, watchlist, alert, and analyst changes. Timeline playback reads those stored records. It does not attempt to reconstruct past state from current rows. A durable deployment should write snapshots transactionally whenever a canonical event, relationship, verification state, severity, confidence assessment, or market assessment changes.

## Alerts and Aether voice

`AlertManager` provides priority ordering, one active alert at a time, deduplication keys, cooldowns, acknowledgement, dismissal, cancellation, and bounded history. Duplicate and syndicated reports do not receive independent event alerts.

The MVP voice provider uses the browser SpeechSynthesis API. Audio remains disabled until the analyst explicitly selects **Enable ARGUS audio**. Every spoken message has a live visual caption, and visual alerts work when speech or browser audio is unavailable. No text-to-speech credential exists in frontend code. A future server-side provider must keep credentials in the Worker or a dedicated trusted service.

Browser notifications are requested only through a user-selected control. Once enabled for the session, the active meaningful alert produces one deduplicated notification; quiet mode suppresses delivery. Thresholds, watchlist-only behavior, volume, and category/asset preferences remain local demonstration settings.

## Camera registry

Camera records preserve operator, source URL, coordinates, usage information, attribution, embed permission, availability, relationships, refresh policy, and access restrictions. The UI embeds only a source whose permission is `verified` and otherwise provides a direct operator link or an intentional unavailable state.

ARGUS must never proxy or bypass authentication, paywalls, geographic restrictions, access controls, or technical protections. Camera URLs must pass the same server-side public-URL and DNS checks as collector URLs before any future availability checker contacts them.

## Monitoring wall

The monitoring wall uses typed widgets and a reusable layout. The demonstration supports drag reordering, width adjustment, reset, browser-local persistence, and full-screen operations mode. A role-protected D1 layout endpoint provides durable storage; the Pages wall deliberately remains browser-local until its save/load UI binds layouts to the authenticated owner ID.

## Public read API

The standalone Worker adds read-only routes:

- `GET /api/relationships`
- `GET /api/market-impacts`
- `GET /api/conflicts`
- `GET /api/operations`

Relationship and market queries use strict schemas and reject unknown fields. Responses are `no-store`, evidence-linked, demonstration-labeled, and carry explicit causality warnings. Protected event, relationship, alert, layout, seed, and retention writes are mounted only on the Worker and remain disabled without its secret and D1 binding.

## Durable schema

The D1 schema includes graph nodes, relationships, relationship history, impact rules, market assets, market assessments, state history, conflict profiles, camera sources, alert history, monitoring layouts, and versioned API read models. Score and coordinate constraints provide final database-level validation. The Worker uses D1 when bound and falls back per empty collection to immutable demonstration fixtures.

## Current limitations

- Reports, prices, conflicts, cameras, alerts, and history are stored fictional snapshots, not live providers.
- The Global Operations View has 3D globe and flat-map modes, but no terrain/elevation source is configured.
- Authenticated review, consequence, alert, audit, and monitoring-layout controls synchronize through the Worker and D1. Unsigned or unavailable-Worker sessions retain visibly labeled fixture behavior.
- Browser speech quality and voice availability depend on the operating system.
- Camera entries demonstrate permission handling and do not embed real feeds.
- Monitoring-wall layouts persist locally in the public UI; the D1 layout endpoint is reserved for authenticated clients.
- Conflict estimates demonstrate source-specific ranges; no real casualty data is present.

Recommended next work is owner-aware layout persistence, controlled collectors and market adapters, normalized ingestion writes, verified camera-source onboarding, terrain/globe performance testing, and a production push-notification gateway.
