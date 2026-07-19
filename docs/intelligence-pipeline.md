# Processing, correlation, and confidence

## Pipeline stages

`ReportProcessingPipeline` executes independently testable stages in order:

1. Validate required fields, timestamps, coordinates, URL scheme, and source identity.
2. Normalize text, locale, country code, and canonical URL.
3. Detect exact and probable duplicate reports.
4. Match known entities without speculative identification.
5. Use structured date/location fields; leave unresolved locations unresolved.
6. Classify category with deterministic keywords.
7. Score association with existing events.
8. Extract sentence-level claim candidates, initially unverified.
9. Flag explicit contradiction language for analyst review.
10. Calculate transparent automated confidence.
11. Finalize the report outcome.

If a stage rejects or fails, later stages are marked skipped in the stage audit. Production persistence should retain that audit and the rejected payload according to a documented retention policy.

## Duplicate detection

Exact external ID, normalized URL, or content hash produces an exact match. Similar title, similar body, and shared independence group produce weighted candidates. Defaults use 0.78 title similarity, 0.82 body similarity, 20 points for a possible candidate, and 50 for probable. Syndicated copies are explicitly marked as non-independent evidence.

These rules reduce double-counting; they do not prove two stories are the same. Probable and possible matches belong in review queues when merging would materially alter an event.

## Event correlation

The correlation engine combines external identifiers, distance, category, title/description similarity, shared entities/keywords, time proximity, contradictions, and country mismatch. Defaults are:

- associate at 60 points
- possible match at 35 points
- close geography within 25 km; extended within 100 km
- close time within 6 hours; extended within 24 hours
- title similarity threshold 0.62
- description similarity threshold 0.55

Every candidate includes its individual signals and score. A possible match is not silently attached. Thresholds must be versioned and evaluated by category; earthquakes, cyber campaigns, maritime incidents, and political events have different useful time/space windows.

## Claims and contradictions

Credibility is represented at claim level as well as event level. Each claim keeps supporting and contradicting report IDs and one of: unverified, corroborated, confirmed, disputed, or rejected. Confirmation is an analyst state. A single event can contain confirmed facts and weak allegations at the same time.

The MVP contradiction detector identifies denial language with token overlap. It is a triage signal, not semantic adjudication. Negation scope, translated text, quantity differences, and timeline changes require stronger parsing and human review.

## Automated confidence

The engine starts with a 20-point evidence baseline, applies positive and negative factors, rounds, and caps the result from 0 to 99. With no accepted evidence it returns 0. Labels are:

| Score | Label |
| --- | --- |
| 0–24 | Unverified |
| 25–49 | Low confidence |
| 50–69 | Moderate confidence |
| 70–89 | High confidence |
| 90–99 | Strongly corroborated |

Factors include official or structured evidence, independent source groups, reliability, matching time/location/details, media, contradictions, circular reporting, missing metadata, stale evidence, sensational language, and unsupported social claims. Each assessment stores factor weights, applied scores, report IDs, calculation time, explanation, and model version.

**Automated confidence is rule coverage, not the mathematical probability that a claim or event is true.** Analyst verification remains separate and never forces the score to 100.

## Evaluation before live use

Build a labeled historical test corpus with lawful redistribution, measure false merges/splits and calibration by category, test adversarial syndicated reporting, version every rule change, and require analyst sign-off for threshold promotion. Retain prior assessments so a dossier can explain why a score changed.
