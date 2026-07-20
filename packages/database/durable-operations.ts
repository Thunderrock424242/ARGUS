import { createAuditEntry } from "@/lib/audit/recorder";
import type { ReviewRequest } from "@/lib/admin/review";
import {
  prepareReadModelUpsert,
  readModelById,
  READ_MODEL_COLLECTIONS,
  seedDemonstrationReadModels,
  type D1DocumentDatabase,
  type D1PreparedStatementLike,
  type ReadModelCollection,
} from "@/packages/database/d1-read-model-provider";
import type {
  AnalystRelationshipState,
  AuditLogEntry,
  IntelligenceAlert,
  IntelligenceEvent,
  IntelligenceRelationship,
  IntelligenceStateChange,
  MonitoringLayout,
  RelationshipHistoryEntry,
} from "@/packages/shared/types";

export class DurableOperationError extends Error {
  override readonly name = "DurableOperationError";

  constructor(
    readonly status: 404 | 409 | 422 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function auditInsert(
  database: D1DocumentDatabase,
  entry: AuditLogEntry,
): D1PreparedStatementLike {
  return database
    .prepare(
      `INSERT INTO audit_logs (
        id, occurred_at, actor_type, actor_id, actor_name, action,
        target_type, target_id, summary, before, after, reason,
        correlation_id, data_classification
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.id,
      entry.occurredAt,
      entry.actorType,
      entry.actorId,
      entry.actorName,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.summary,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      entry.reason ?? null,
      entry.correlationId,
      entry.dataClassification,
    );
}

function appendNote(existing: string | undefined, note: string): string {
  return [existing?.trim(), note.trim()].filter(Boolean).join("\n\n");
}

function updateClaim(
  event: IntelligenceEvent,
  claimId: string,
  status: "confirmed" | "rejected",
): void {
  const claims = [
    ...event.confirmedFacts,
    ...event.unverifiedClaims,
    ...event.disputedClaims,
  ];
  const claim = claims.find((item) => item.id === claimId);
  if (!claim) {
    throw new DurableOperationError(
      404,
      "claim_not_found",
      "The target claim does not belong to this event.",
    );
  }
  event.confirmedFacts = event.confirmedFacts.filter((item) => item.id !== claimId);
  event.unverifiedClaims = event.unverifiedClaims.filter((item) => item.id !== claimId);
  event.disputedClaims = event.disputedClaims.filter((item) => item.id !== claimId);
  const updated = { ...claim, status, updatedAt: new Date().toISOString() };
  if (status === "confirmed") event.confirmedFacts.push(updated);
  else event.unverifiedClaims.push(updated);
}

export async function applyEventReview(
  database: D1DocumentDatabase,
  request: ReviewRequest,
  requestId: string,
  occurredAt = new Date().toISOString(),
  actorId?: string,
): Promise<{ event: IntelligenceEvent; audit: AuditLogEntry; stateChange: IntelligenceStateChange }> {
  const event = await readModelById<IntelligenceEvent>(
    database,
    READ_MODEL_COLLECTIONS.events,
    request.eventId,
  );
  if (!event) {
    throw new DurableOperationError(404, "event_not_found", "The target event does not exist in D1.");
  }
  const before = structuredClone(event);

  switch (request.action) {
    case "confirm":
      event.verificationState = "analyst-confirmed";
      if (event.status === "rejected" || event.status === "disputed") event.status = "active";
      event.reviewRequired = false;
      break;
    case "reject":
      event.verificationState = "analyst-rejected";
      event.status = "rejected";
      event.reviewRequired = false;
      break;
    case "dispute":
      event.verificationState = "disputed";
      event.status = "disputed";
      event.reviewRequired = true;
      break;
    case "request-evidence":
      event.reviewRequired = true;
      event.analystNotes = appendNote(
        event.analystNotes,
        `Evidence requested by ${request.reviewerName}: ${request.reason ?? "Additional corroboration required."}`,
      );
      break;
    case "edit":
      Object.assign(event, request.updates);
      break;
    case "merge": {
      const targets = request.relatedEventIds ?? [];
      for (const targetId of targets) {
        if (targetId === event.id) {
          throw new DurableOperationError(422, "invalid_merge_targets", "An event cannot be merged into itself.");
        }
        const target = await readModelById<IntelligenceEvent>(
          database,
          READ_MODEL_COLLECTIONS.events,
          targetId,
        );
        if (!target) {
          throw new DurableOperationError(404, "merge_target_not_found", "A merge target does not exist in D1.");
        }
      }
      event.relatedEventIds = [...new Set([...event.relatedEventIds, ...targets])];
      break;
    }
    case "separate":
      event.sourceReportIds = event.sourceReportIds.filter(
        (reportId) => !request.reportIds?.includes(reportId),
      );
      event.supportingSourceCount = Math.min(
        event.supportingSourceCount,
        event.sourceReportIds.length,
      );
      break;
    case "confirm-claim":
      updateClaim(event, request.claimId!, "confirmed");
      break;
    case "reject-claim":
      updateClaim(event, request.claimId!, "rejected");
      break;
    case "pin-priority":
      event.priority = true;
      break;
    case "add-watchlist": {
      const watchlist = await readModelById(
        database,
        READ_MODEL_COLLECTIONS.watchlists,
        request.watchlistId!,
      );
      if (!watchlist) {
        throw new DurableOperationError(404, "watchlist_not_found", "The selected watchlist does not exist in D1.");
      }
      event.watchlistIds = [...new Set([...event.watchlistIds, request.watchlistId!])];
      break;
    }
  }

  event.lastUpdatedAt = occurredAt;
  event.reviewedAt = occurredAt;
  event.reviewerName = request.reviewerName;

  const audit = createAuditEntry({
    action:
      request.action === "confirm" ? "event-confirmed" :
      request.action === "reject" ? "event-rejected" :
      request.action === "dispute" ? "event-disputed" :
      request.action === "request-evidence" ? "evidence-requested" :
      request.action === "merge" ? "events-merged" :
      request.action === "separate" ? "event-separated" :
      request.action === "confirm-claim" ? "claim-confirmed" :
      request.action === "reject-claim" ? "claim-rejected" :
      request.action === "pin-priority" ? "priority-pinned" :
      request.action === "add-watchlist" ? "watchlist-added" : "event-edited",
    targetType: request.claimId ? "claim" : "event",
    targetId: request.claimId ?? event.id,
    actorName: request.reviewerName,
    actorId,
    summary: `${request.reviewerName} durably recorded ${request.action} for ${event.title}.`,
    requestId,
    before,
    after: event,
    reason: request.reason,
    occurredAt,
  });
  const stateChange: IntelligenceStateChange = {
    id: `state-${crypto.randomUUID()}`,
    occurredAt,
    type: "analyst-decision",
    eventId: event.id,
    title: `Analyst ${request.action}`,
    description: audit.summary,
    before: { verificationState: before.verificationState, status: before.status },
    after: { verificationState: event.verificationState, status: event.status },
    reportIds: request.reportIds ?? [],
    actor: "analyst",
    dataClassification: "demonstration",
  };
  return { event, audit, stateChange };
}

export async function recordDurableEventReview(
  database: D1DocumentDatabase,
  request: ReviewRequest,
  requestId: string,
  actorId?: string,
): Promise<{ event: IntelligenceEvent; audit: AuditLogEntry; stateChange: IntelligenceStateChange }> {
  const result = await applyEventReview(database, request, requestId, new Date().toISOString(), actorId);
  await database.batch([
    prepareReadModelUpsert(database, READ_MODEL_COLLECTIONS.events, result.event),
    prepareReadModelUpsert(database, READ_MODEL_COLLECTIONS.stateHistory, result.stateChange),
    auditInsert(database, result.audit),
  ]);
  return result;
}

export interface RelationshipReviewInput {
  analystState: Exclude<AnalystRelationshipState, "automated">;
  reviewerName: string;
  reason: string;
  analystNotes?: string;
  relationshipConfidence?: number;
  exposureConfidence?: number;
  causalConfidence?: number;
  actorId?: string;
}

export async function recordDurableRelationshipReview(
  database: D1DocumentDatabase,
  relationshipId: string,
  input: RelationshipReviewInput,
  requestId: string,
): Promise<{ relationship: IntelligenceRelationship; history: RelationshipHistoryEntry; audit: AuditLogEntry }> {
  const relationship = await readModelById<IntelligenceRelationship>(
    database,
    READ_MODEL_COLLECTIONS.relationships,
    relationshipId,
  );
  if (!relationship) {
    throw new DurableOperationError(404, "relationship_not_found", "The relationship does not exist in D1.");
  }
  const before = structuredClone(relationship);
  const occurredAt = new Date().toISOString();
  relationship.analystState = input.analystState;
  relationship.analystNotes = input.analystNotes ?? input.reason;
  relationship.relationshipConfidence = input.relationshipConfidence ?? relationship.relationshipConfidence;
  relationship.exposureConfidence = input.exposureConfidence ?? relationship.exposureConfidence;
  relationship.causalConfidence = input.causalConfidence ?? relationship.causalConfidence;
  relationship.lastRecalculatedAt = occurredAt;
  if (input.analystState === "rejected") relationship.relationshipType = "analyst-rejected";
  if (input.analystState === "disputed") relationship.relationshipType = "disputed";

  const history: RelationshipHistoryEntry = {
    id: `rel-history-${crypto.randomUUID()}`,
    relationshipId,
    occurredAt,
    relationshipConfidence: relationship.relationshipConfidence,
    exposureConfidence: relationship.exposureConfidence,
    causalConfidence: relationship.causalConfidence,
    marketAnomalyScore: relationship.marketAnomalyScore,
    analystState: relationship.analystState,
    explanation: relationship.explanation,
    supportingReportIds: relationship.supportingReportIds,
    contradictingReportIds: relationship.contradictingReportIds,
    rulesetVersion: relationship.modelVersion,
    actor: "analyst",
    dataClassification: "demonstration",
  };
  const audit = createAuditEntry({
    action:
      input.analystState === "confirmed" ? "relationship-confirmed" :
      input.analystState === "rejected" ? "relationship-rejected" :
      input.analystState === "disputed" ? "relationship-disputed" :
      "relationship-recalculated",
    targetType: "relationship",
    targetId: relationshipId,
    actorName: input.reviewerName,
    actorId: input.actorId,
    summary: `${input.reviewerName} reviewed relationship ${relationshipId}.`,
    requestId,
    before,
    after: relationship,
    reason: input.reason,
    occurredAt,
  });
  await database.batch([
    prepareReadModelUpsert(database, READ_MODEL_COLLECTIONS.relationships, relationship),
    prepareReadModelUpsert(database, READ_MODEL_COLLECTIONS.relationshipHistory, history),
    auditInsert(database, audit),
  ]);
  return { relationship, history, audit };
}

export async function saveDurableMonitoringLayout(
  database: D1DocumentDatabase,
  layout: MonitoringLayout,
  reviewerName: string,
  requestId: string,
  actorId?: string,
): Promise<{ layout: MonitoringLayout; audit: AuditLogEntry }> {
  const occurredAt = new Date().toISOString();
  const before = await readModelById<MonitoringLayout>(
    database,
    READ_MODEL_COLLECTIONS.monitoringLayouts,
    layout.id,
  );
  const updated = { ...structuredClone(layout), updatedAt: occurredAt };
  const audit = createAuditEntry({
    action: "monitoring-layout-saved",
    targetType: "monitoring-layout",
    targetId: layout.id,
    actorName: reviewerName,
    actorId,
    summary: `${reviewerName} saved monitoring layout ${layout.name}.`,
    requestId,
    before,
    after: updated,
    occurredAt,
  });
  await database.batch([
    prepareReadModelUpsert(database, READ_MODEL_COLLECTIONS.monitoringLayouts, updated),
    auditInsert(database, audit),
  ]);
  return { layout: updated, audit };
}

export async function recordDurableAlertAction(
  database: D1DocumentDatabase,
  alertId: string,
  action: "acknowledge" | "dismiss",
  reviewerName: string,
  requestId: string,
  actorId?: string,
): Promise<{ alert: IntelligenceAlert; audit: AuditLogEntry }> {
  const alert = await readModelById<IntelligenceAlert>(
    database,
    READ_MODEL_COLLECTIONS.alerts,
    alertId,
  );
  if (!alert) throw new DurableOperationError(404, "alert_not_found", "The alert does not exist in D1.");
  if (alert.state === "acknowledged" || alert.state === "dismissed") {
    throw new DurableOperationError(409, "alert_already_resolved", "The alert has already been resolved.");
  }
  const before = structuredClone(alert);
  const occurredAt = new Date().toISOString();
  alert.state = action === "acknowledge" ? "acknowledged" : "dismissed";
  if (action === "acknowledge") alert.acknowledgedAt = occurredAt;
  else alert.dismissedAt = occurredAt;
  const audit = createAuditEntry({
    action: action === "acknowledge" ? "alert-acknowledged" : "alert-dismissed",
    targetType: "alert",
    targetId: alert.id,
    actorName: reviewerName,
    actorId,
    summary: `${reviewerName} ${action === "acknowledge" ? "acknowledged" : "dismissed"} alert ${alert.title}.`,
    requestId,
    before,
    after: alert,
    occurredAt,
  });
  await database.batch([
    prepareReadModelUpsert(database, READ_MODEL_COLLECTIONS.alerts, alert),
    auditInsert(database, audit),
  ]);
  return { alert, audit };
}

const RETENTION_COLLECTIONS: ReadModelCollection[] = [
  READ_MODEL_COLLECTIONS.reports,
  READ_MODEL_COLLECTIONS.relationshipHistory,
  READ_MODEL_COLLECTIONS.stateHistory,
  READ_MODEL_COLLECTIONS.alerts,
];

export async function enforceReadModelRetention(
  database: D1DocumentDatabase,
  before: string,
  collections: ReadModelCollection[] = RETENTION_COLLECTIONS,
  auditContext?: {
    actorName: string;
    actorId?: string;
    actorType?: AuditLogEntry["actorType"];
    requestId: string;
  },
): Promise<{ before: string; collections: ReadModelCollection[]; auditId?: string }> {
  const allowed = collections.filter((collection) => RETENTION_COLLECTIONS.includes(collection));
  if (!allowed.length) {
    throw new DurableOperationError(422, "invalid_retention_scope", "No permitted retention collection was selected.");
  }
  const statements = allowed.map((collection) =>
      database
        .prepare(
          "DELETE FROM intelligence_read_models WHERE collection = ? AND updated_at < ?",
        )
        .bind(collection, before),
  );
  const audit = auditContext ? createAuditEntry({
    action: "retention-enforced",
    targetType: "read-model",
    targetId: allowed.join(","),
    actorName: auditContext.actorName,
    actorId: auditContext.actorId,
    actorType: auditContext.actorType,
    summary: `${auditContext.actorName} enforced retention before ${before} for ${allowed.join(", ")}.`,
    requestId: auditContext.requestId,
    after: { before, collections: allowed },
  }) : undefined;
  if (audit) statements.push(auditInsert(database, audit));
  await database.batch(statements);
  return { before, collections: allowed, auditId: audit?.id };
}

export async function seedDurableDemonstrationData(
  database: D1DocumentDatabase,
  reviewerName: string,
  requestId: string,
  actorId?: string,
): Promise<{ collections: number; records: number; auditId: string }> {
  const result = await seedDemonstrationReadModels(database);
  const audit = createAuditEntry({
    action: "read-model-seeded",
    targetType: "read-model",
    targetId: "demonstration-dataset",
    actorName: reviewerName,
    actorId,
    summary: `${reviewerName} seeded ${result.records} demonstration read models across ${result.collections} collections.`,
    requestId,
    after: result,
  });
  await auditInsert(database, audit).run();
  return { ...result, auditId: audit.id };
}
