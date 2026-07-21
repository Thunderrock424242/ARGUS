# Orbital Watch implementation design

> **Status: design only.** This document proposes a future ARGUS screen and data architecture. It does not enable live collection, add a route, change the database, or install a renderer.

## Product decision

Add one separate **Orbital Watch** screen at `/orbit`. Do not overload the existing Global Map: MapLibre is well suited to terrestrial event coordinates, but an orbital view needs time-dependent three-dimensional positions, multiple reference frames, object-age warnings, and a different definition of risk.

Orbital Watch should have three modes inside the same route:

1. **Earth Orbit** — satellites and other cataloged Earth-orbiting objects around a 3D Earth, with ground tracks, predicted passes, orbit class, element age, and source status.
2. **Near Earth** — upcoming asteroid and comet close approaches, selected trajectories, uncertainty, and NASA/JPL impact-monitoring results.
3. **Solar Activity** — the Sun, planets, current solar events, and modeled Earth-directed activity on a compressed solar-system scene and synchronized event timeline.

The screen is an awareness and research surface, not a flight-safety, collision-avoidance, astronomical-navigation, or emergency-warning system. Every position and event must show its source, source timestamp, retrieval timestamp, and whether the displayed location is observed, published, propagated, or modeled.

## What “live” means

ARGUS must not describe every moving marker as live telemetry.

- Earth-satellite positions are normally **SGP4 predictions derived from a published general-perturbations element set**. The marker can move smoothly in real time, but its source state is an element-set epoch, not a continuous NASA location feed.
- Asteroid and comet positions are **ephemerides or close-approach predictions** derived from NASA/JPL data.
- Solar records are **recent observations, analyses, simulations, or notifications** published through NASA DONKI; their type must remain visible.
- A browser animation timestamp is not data freshness. The UI should show both `propagated for 21 Jul 2026 01:42 UTC` and `elements epoch 20 Jul 2026 14:08 UTC`, for example.

Use labels such as **current source data**, **predicted position**, **modeled arrival**, and **last synchronized**. Do not use a generic **NASA live tracking** badge.

## Data authority and source plan

NASA/JPL is the primary authority for near-Earth objects and solar-system ephemerides, but it is not the catalog source for all Earth-orbiting satellites. Satellite and space-weather sources therefore need explicit attribution rather than a single NASA umbrella label.

| Domain | Initial source | What ARGUS may claim | Initial refresh policy | Important boundary |
| --- | --- | --- | --- | --- |
| Earth satellites | [CelesTrak GP data](https://celestrak.org/NORAD/documentation/gp-data-formats.php), in OMM-compatible JSON or CSV | Published orbital elements, propagated current position, orbit class, and element age | No more often than every 2 hours; reuse a Worker/D1 snapshot | CelesTrak states that its GP source is checked every two hours. This is not NASA data and not continuous telemetry. |
| Close approaches | [NASA/JPL SBDB Close-Approach Data API](https://ssd-api.jpl.nasa.gov/doc/cad.html) | Published close-approach time, distance and uncertainty, relative velocity, and object identity | Every 6 hours, plus a manual protected refresh | A close approach alone is not an impact prediction. Preserve the API signature/version. |
| Impact monitoring | [NASA/JPL Sentry API](https://ssd-api.jpl.nasa.gov/doc/sentry.html) | Whether an object is present in Sentry and the published virtual-impactor, probability, Torino, and Palermo values | Every 6 hours, after the close-approach sync | Absence from Sentry is not proof that an object is harmless; it means no Sentry record was returned in that snapshot. |
| Object trajectories | [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Cached position/state-vector samples for a selected object and time window | On demand through a serialized, cached server job | JPL permits only one SSD API request at a time and forbids direct website embedding under its CORS policy. Never query Horizons per animation frame. |
| Solar activity | [NASA DONKI](https://api.nasa.gov/) | Published CME, flare, geomagnetic-storm, interplanetary-shock, SEP, high-speed-stream, notification, and WSA-Enlil records | Every 15 minutes with bounded date windows | Keep the NASA API key in a Worker secret. Distinguish observations, analyses, model output, and notifications. |
| Operational space-weather warnings, optional | [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/products-and-data) | Official NOAA warning/watch/scale text displayed with NOAA attribution | Match the selected official product; cache server-side | Use this only as a separately attributed corroborating/operational layer, never relabel it as NASA. |
| Conjunction data, later phase | Authorized Space-Track/CDM source | A conjunction condition only when backed by an allowed, current conjunction data message | Source and terms dependent | GP/TLE orbit intersections are not enough to claim collision risk. Do not ship this layer until access, redistribution terms, and parser validation are complete. |

The existing `NasaEonetCollector` in `packages/intelligence/collectors.ts` is for terrestrial natural events. Reuse its collector security lessons, but do not treat EONET as an orbital or space-weather feed.

NASA/JPL's [SSD API fair-use policy](https://ssd-api.jpl.nasa.gov/doc/index.php) requires serialized requests, disallows embedding the APIs directly in a website, and requires clients to check response versions. All SSD and Horizons traffic must therefore go through an ARGUS server-side adapter and cache.

## Screen composition

The screen should retain the ARGUS shell and operational visual language while giving the visualization most of the viewport.

```text
+----------------------------------------------------------------------------------+
| Orbital Watch  [Earth Orbit] [Near Earth] [Solar Activity]  UTC  Source health  |
+----------------------+------------------------------------------+----------------+
| Search / filters     |                                          | Selected       |
| - object group       |            3D scene                      | object/event   |
| - altitude/class     |                                          | source + age   |
| - risk/watch state   |                                          | key values     |
| - source freshness   |                                          | linked records |
+----------------------+------------------------------------------+----------------+
| -24 h -------------- NOW ---------------- +7 d       play / pause / rate / reset |
+----------------------------------------------------------------------------------+
| Synchronized, keyboard-accessible object and event table                         |
+----------------------------------------------------------------------------------+
```

Common controls:

- Search by object name, NORAD catalog number, international designator, JPL designation, or event identifier.
- UTC time scrubber with pause, current-time reset, step, and bounded playback speed.
- Filters for source, object class, orbit regime, watch state, freshness, event type, and time window.
- A selected-object drawer with raw published values, derived values clearly marked, source links, update age, and any related ARGUS records.
- A synchronized table/list that remains usable if WebGL, textures, or orbit propagation fail.
- Shareable URL state for mode, selected object, filters, and time, but never secrets or raw restricted payloads.

Mode-specific behavior:

### Earth Orbit

- Start with bounded groups such as stations, active satellites, weather, navigation, and a user watchlist. Do not render the entire catalog in the first release.
- Render Earth, the selected object's orbit, current propagated position, sub-satellite point, and an optional recent/future ground track.
- Show `LEO`, `MEO`, `GEO`, `HEO`, or `other` as a derived classification with the rule version exposed.
- Encode payload, rocket body, and debris by shape as well as color when the source provides a trustworthy object type.
- Mark stale element sets and stop confident propagation after a configured age. A stale object should become **position uncertain**, not silently disappear.
- Never infer a collision alert merely because two rendered lines cross or two propagated samples pass near one another.

### Near Earth

- List upcoming Earth close approaches first, sortable by date, nominal distance, minimum uncertainty distance, relative velocity, diameter availability, and Sentry presence.
- Use lunar distance and kilometers alongside astronomical units; show conversion rules and source units.
- Draw only a selected object's cached Horizons trajectory. The overview can use summarized approach markers so the scene does not imply precise simultaneous positions for every object.
- Visualize uncertainty when supplied. Exaggerated object sizes and compressed distances need an always-visible **not to scale** legend.
- Link the close-approach record, Sentry record when present, and Horizons retrieval metadata without merging them into one invented NASA score.

### Solar Activity

- Display a deliberately compressed solar-system scene with an explicit scale mode: `log distance`, `compressed`, or `local Earth-Sun`.
- Plot DONKI events on a time-aligned event rail. CME cones and WSA-Enlil paths are model visualizations, not observed solid objects.
- Highlight Earth-directed or Earth-associated records only when the source explicitly provides that association.
- Keep flare class, CME speed, arrival-time model, geomagnetic-storm measurements, and notifications as separate fields. Do not collapse them into a synthetic certainty percentage.

## Threat and attention indicators

The user-facing control may be called **Threat indicators**, but the domain model should use `attentionState` and preserve the official risk fields. This reduces the chance that a red marker is mistaken for a government warning.

Proposed states:

| State | Meaning | Allowed triggers |
| --- | --- | --- |
| `information` | A current object/event record exists | Valid, fresh source record |
| `watch` | The record deserves analyst attention | Explicit watchlist match, potential decay dataset, Sentry listing, or official space-weather watch |
| `elevated` | An official published field crosses a reviewed display rule | For example, a non-zero Torino value, Palermo at or above the reviewed threshold, or an official warning severity |
| `stale` | The source age exceeds the mode's freshness limit | Element/snapshot age only; this is a data-quality warning |
| `unknown` | Required data is absent, malformed, or unavailable | Parser, source, or synchronization failure |

Rules:

- Always display the official Torino, Palermo, impact-probability, uncertainty, flare-class, or warning value beside any derived state.
- Treat NASA's Palermo guidance as display context, not permission to create an ARGUS impact forecast. NASA describes values below `-2` as unlikely to have consequences, values from `-2` to `0` as meriting careful monitoring, and positive values as generally meriting concern.
- Do not label a potentially hazardous asteroid, a close approach, or a Sentry listing as an expected impact.
- Do not add a satellite `elevated` state without an authorized conjunction or decay source. Element age can create `stale`, not collision risk.
- Never auto-generate a `critical` space alert in the first release. An analyst-reviewed rule and an official supporting record must be added before that state exists.
- Every derived indicator stores `ruleId`, `ruleVersion`, `evaluatedAt`, source record IDs, and an explanation.

## Fit with the current ARGUS architecture

### Route and interface

The future implementation should touch these existing boundaries:

- `site/main.tsx`: lazy route import, `/orbit` route, and route title.
- `components/shell/app-shell.tsx`: one **Orbital Watch** navigation item near Global Map.
- `app/orbit/page.tsx`: route shell, demonstration label, source status, and degraded states.
- `components/orbit/`: scene, filters, timeline, object drawer, accessible table, and worker bridge.
- `components/runtime/runtime-data-provider.tsx`: add an orbital snapshot provider only if multiple screens consume it. Otherwise keep the first version local to the route.
- `app/globals.css`: screen layout and renderer overlays, while retaining existing ARGUS tokens.

Lazy-load the scene renderer and its propagation worker. The normal application, dossiers, and event map must not pay the orbital bundle or GPU cost.

### Separate orbital read model

Do not force high-frequency orbital state into `SourceReport` or `IntelligenceEvent`. Those types represent attributable evidence and correlated situations; an element set or ephemeris sample is operational state with different volume and retention needs.

Add an `OrbitalDataProvider` beside `IntelligenceDataProvider`, with concepts equivalent to:

| Record | Purpose |
| --- | --- |
| `SpaceObject` | Stable source-qualified identity, names/designations, object class, and source IDs |
| `OrbitalElementSet` | Published Earth-orbit elements, epoch, format/version, retrieval metadata, and source provenance |
| `EphemerisSeries` | Bounded vectors/samples, frame, center, time system, units, source query, and cache expiry |
| `CloseApproach` | JPL-published approach fields and uncertainty without invented risk |
| `ImpactRiskRecord` | Sentry virtual-impactor and scale fields, kept distinct from close approaches |
| `SpaceWeatherEvent` | Typed DONKI observation, analysis, simulation, or notification |
| `SpaceAttentionAssessment` | Transparent ARGUS display rule result with supporting source record IDs |
| `OrbitalSourceSync` | Attempt, status, response signature/version, counts, cursor/window, error, and freshness |

All identities must be source-qualified. A NORAD catalog number, international designator, JPL SPK ID, and small-body designation are different identifiers and must not be joined by name alone.

### Collection flow

```text
Cloudflare scheduled handler / protected refresh
  -> fixed-host, bounded source adapter
  -> strict source-specific parser and version check
  -> normalized orbital transaction in D1
  -> source-sync audit and last-known-good snapshot
  -> public no-store ARGUS read API with ETag/version metadata
  -> browser Web Worker propagation / interpolation
  -> 3D renderer plus synchronized accessible table
```

The existing collector runtime is useful for retries, dead letters, source health, fixed-host transport, bounded responses, and audit conventions. Its `CollectedReport[]` output is not the right persistence contract for orbital snapshots. Extract or reuse the scheduling/transport policy, then write through a dedicated orbital store. Only a noteworthy condition intentionally promoted for analyst review should enter `ingestion_submissions` and the normal report/event pipeline.

### D1 tables

A first durable schema should use append-only source observations where history matters and compact current snapshots for the browser:

- `space_objects`
- `orbital_element_sets`
- `space_close_approaches`
- `space_impact_risks`
- `space_ephemeris_series` and `space_ephemeris_samples`
- `space_weather_events`
- `space_attention_assessments`
- `orbital_source_syncs`

Recommended keys include `(source_id, external_id)` for source records, source epoch plus object ID for elements, and an explicit snapshot/version column for conditional reads. Keep the latest element set hot, retain a bounded history for diagnostics, and do not store per-animation-frame propagated positions.

### Worker API

Proposed read routes:

- `GET /api/orbit/snapshot?mode=earth-orbit&group=stations`
- `GET /api/orbit/objects/:source/:id`
- `GET /api/orbit/close-approaches?from=...&to=...`
- `GET /api/orbit/impact-risks`
- `GET /api/orbit/space-weather?from=...&to=...`
- `GET /api/orbit/ephemeris/:source/:id?from=...&to=...&step=...`
- `GET /api/orbit/health`

Proposed protected route:

- `POST /api/admin/orbit/sync` for an authorized dry run or one bounded source refresh.

Use strict Zod schemas, bounded windows, pagination/record caps, canonical identifiers, `no-store` browser responses, request IDs, and source snapshot versions. Cache source data in D1 or Worker Cache even though the public ARGUS response remains `no-store`. Never expose the NASA API key, Space-Track credentials, raw authorization headers, or restricted source payloads.

## Renderer and propagation recommendation

Use a dedicated Three.js scene for this route rather than extending MapLibre. One renderer can support Earth-orbit and solar-system modes, shared picking, labels, camera controls, and a common time controller. A later implementation would likely add:

- `three` for the scene;
- `satellite.js` or another audited SGP4 implementation for GP/OMM propagation;
- a dedicated Web Worker for propagation and trajectory sampling;
- instanced points/meshes and level-of-detail rules for object groups;
- a small, attribution-reviewed Earth texture stored with the static site or served from an approved host.

Important rendering constraints:

- Propagate only visible/filter-matched objects at the cadence needed for the current zoom. Rendering may interpolate at frame rate without recomputing every object every frame.
- Transfer packed numeric buffers from the Web Worker; do not pass thousands of object-shaped React states on every tick.
- Keep labels sparse and selected-object-first. Use GPU picking or a bounded spatial index rather than one DOM element per object.
- Pause work when the tab is hidden and honor reduced motion, battery-saving, and low-detail modes.
- Detect WebGL/context loss and fall back to the synchronized table and source-health panels.
- Test both UTC and source-specific time systems. JPL close-approach and ephemeris times cannot be treated as arbitrary local browser dates.

## Security, source, and ethics rules

- Fetch every external feed server-side through a fixed hostname allowlist, redirect refusal, timeout, byte cap, content-type check, and response-schema limit.
- Serialize NASA/JPL SSD requests across scheduled and on-demand work. Cache aggressively enough that multiple users do not multiply upstream calls.
- Check and persist JPL response `signature.source` and `signature.version`; fail closed to the last-known-good snapshot after an unexpected version change.
- Put the NASA API key and any future restricted source credentials only in Wrangler secrets.
- Record source usage, attribution, redistribution, and retention requirements before enabling a source.
- Do not expose sensitive or restricted orbital data, attempt to infer hidden objects, or present the screen as operational collision avoidance.
- Preserve corrections and removals as source-state changes. Do not silently rewrite history when Sentry removes an object or an element set is superseded.

## Delivery phases

### Phase 0 — contracts and fixtures

- Add the orbital domain types, source adapters as interfaces, provider boundary, and fictional fixtures.
- Specify identifier mapping, units, time systems, data age, error states, and attention rules.
- Add parser fixtures captured from documented source shapes without enabling network collection.

### Phase 1 — demonstration screen

- Add `/orbit`, the navigation item, lazy-loaded Three.js scene, list fallback, object drawer, filters, and time controls.
- Render fictional satellites, a close approach, and solar events with the existing demonstration banner.
- Add reduced-motion, keyboard, screen-reader, WebGL-failure, and small-screen behavior.

### Phase 2 — NASA/JPL read path

- Add serialized, cached SBDB CAD, Sentry, Horizons, and DONKI server adapters.
- Persist versioned normalized records and source sync health in D1.
- Keep the real-data layer separately labeled and disabled until the existing ARGUS real-world-data release gate is satisfied.

### Phase 3 — Earth-orbit data

- Add a CelesTrak OMM-compatible adapter with two-hour caching and strict element-age handling.
- Propagate a few reviewed groups in a Web Worker and validate reference vectors against known SGP4 cases.
- Do not add conjunction indicators in this phase.

### Phase 4 — reviewed attention and ARGUS links

- Add transparent attention assessments, object watchlists, review workflow, and optional links to existing events/briefs.
- Promote a source condition into the intelligence pipeline only through an explicit, attributable, audited rule and analyst review.

### Phase 5 — optional operational sources

- Evaluate NOAA warnings and authorized Space-Track/CDM access, terms, redistribution, and retention.
- Add conjunction displays only after CDM parsing, unit/frame validation, source freshness checks, and operator review are complete.

## Verification gate

The feature is not complete until the following are proven:

- Parser tests reject missing identifiers, unexpected source versions, invalid units/times, oversized arrays, and malformed coordinates.
- SGP4 propagation matches published reference cases within a documented tolerance.
- The browser never calls NASA/JPL, CelesTrak, NOAA, or Space-Track directly.
- Repeated users receive the same cached source snapshot without multiplying upstream requests.
- A stale element set visibly changes to `stale` or `unknown`; it never remains nominal indefinitely.
- A close approach without Sentry risk is never displayed as an expected impact.
- No satellite collision warning can be produced from GP/OMM proximity alone.
- UTC, TDB, frames, centers, distance units, and scale compression are visible and tested.
- WebGL failure leaves a complete keyboard-accessible object/event table.
- The existing `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run brain:check` checks still pass.
- Live-source enablement remains a separate operator decision after security, source terms, retention, corrections, and analyst-review procedures are approved.

## Explicit non-goals for the first release

- Satellite command and control, maneuver planning, or collision avoidance.
- A complete resident-space-object catalog in the browser.
- Real-time telescope or spacecraft telemetry.
- Inferring restricted, classified, or intentionally unpublished objects.
- Treating visual proximity, line crossings, PHA status, or a close approach as proof of danger.
- Replacing NASA, JPL, NOAA, CelesTrak, Space-Track, or emergency authorities as the source of an alert.
