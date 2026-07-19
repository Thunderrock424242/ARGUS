# Analyst review workflow

## Review queues

ARGUS organizes attention around low-confidence events, high-severity unverified events, contradictions, possible duplicates, failed correlations, unprocessed reports, source failures, watchlist matches, and Aether recommendations. Queue priority is triage, not truth.

A review should start from the event dossier and inspect claim-level evidence, source independence, original timestamps, location, contradictions, score factors, related events, and the complete timeline. Analysts should prefer a reversible state such as disputed or request-more-evidence when available evidence is insufficient.

## Supported action model

The protected review API validates these actions:

- confirm or reject an event
- mark an event disputed
- request more evidence
- edit title, summary, category, severity, or analyst notes
- merge events or separate reports
- confirm or reject an individual claim
- pin priority intelligence
- add an event to an existing watchlist

Reject, dispute, request-evidence, merge, and separate actions require a reason. Claim IDs must belong to the event. Separated reports must already be linked. Merge targets must exist, be unique, and exclude the canonical event. Unknown fields are rejected rather than ignored.

## Administrative request

The route is unavailable until a server-only token exists. Example local request shape (use an environment variable in the shell; never paste a real token into documentation or history):

```http
POST /api/admin/review
Authorization: Bearer <server-configured-token>
Content-Type: application/json

{
  "action": "dispute",
  "eventId": "evt-example",
  "reviewerName": "Analyst",
  "reason": "Two independent records disagree on the affected facility."
}
```

Responses include a request/correlation ID and audit ID but never echo authorization. In the MVP they also say `durability: "process-memory"` and `canonicalDataMutated: false`. This is an honest demonstration boundary, not a successful durable edit.

## Production transaction

A production review service should:

1. Authenticate identity through the hosting access layer.
2. Authorize an explicit role such as viewer, reviewer, source manager, or administrator.
3. Rate-limit by trusted user and deployment.
4. Re-read the target and enforce an optimistic version to prevent lost updates.
5. Validate action-specific invariants.
6. Update the event/claim/evidence links and review queue in one transaction.
7. Append an immutable audit record containing before/after state, reason, actor, and correlation ID.
8. Recalculate derived views and notify only after commit.

The audit log should be append-only for ordinary application roles. Corrections should create a new record that references the prior action rather than rewriting history.

## Analyst standards

- Separate observed facts, source claims, ARGUS inference, analyst judgment, and Aether analysis.
- Cite the stored report behind every factual decision.
- Do not increase confidence merely because many syndicated copies exist.
- Record uncertainty and collection gaps.
- Avoid identifying or targeting private individuals.
- Correct and reject inaccurate events promptly while retaining an accountable history.
