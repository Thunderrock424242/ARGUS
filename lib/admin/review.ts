import { z } from "zod";
import { auditRecorder, createAuditEntry, type AuditRecorder } from "@/lib/audit/recorder";
import { intelligenceDataProvider } from "@/packages/database/provider";
import type {
  AuditAction,
  IntelligenceDataProvider,
  IntelligenceEvent,
} from "@/packages/shared/types";
import { EVENT_CATEGORIES } from "@/lib/api/schemas";

const targetIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

const eventUpdatesSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    summary: z.string().trim().min(10).max(5_000).optional(),
    category: z.enum(EVENT_CATEGORIES).optional(),
    severity: z.number().int().min(1).max(5).optional(),
    analystNotes: z.string().trim().max(10_000).optional(),
  })
  .strict();

export const reviewRequestSchema = z
  .object({
    action: z.enum([
      "confirm",
      "reject",
      "dispute",
      "request-evidence",
      "edit",
      "merge",
      "separate",
      "confirm-claim",
      "reject-claim",
      "pin-priority",
      "add-watchlist",
    ]),
    eventId: targetIdentifier,
    reviewerName: z.string().trim().min(1).max(100).default("Deployment Operator"),
    reason: z.string().trim().min(3).max(2_000).optional(),
    updates: eventUpdatesSchema.optional(),
    claimId: targetIdentifier.optional(),
    relatedEventIds: z.array(targetIdentifier).min(1).max(10).optional(),
    reportIds: z.array(targetIdentifier).min(1).max(50).optional(),
    watchlistId: targetIdentifier.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "edit" && (!value.updates || Object.keys(value.updates).length === 0)) {
      context.addIssue({
        code: "custom",
        path: ["updates"],
        message: "An edit action requires at least one validated update.",
      });
    }
    if (["confirm-claim", "reject-claim"].includes(value.action) && !value.claimId) {
      context.addIssue({ code: "custom", path: ["claimId"], message: "A claim action requires claimId." });
    }
    if (value.action === "merge" && !value.relatedEventIds?.length) {
      context.addIssue({
        code: "custom",
        path: ["relatedEventIds"],
        message: "A merge action requires at least one related event.",
      });
    }
    if (value.action === "separate" && !value.reportIds?.length) {
      context.addIssue({
        code: "custom",
        path: ["reportIds"],
        message: "A separate action requires at least one report.",
      });
    }
    if (value.action === "add-watchlist" && !value.watchlistId) {
      context.addIssue({
        code: "custom",
        path: ["watchlistId"],
        message: "A watchlist action requires watchlistId.",
      });
    }
    if (["reject", "dispute", "request-evidence", "merge", "separate"].includes(value.action) && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "This review action requires an analyst reason.",
      });
    }
  });

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

export class ReviewActionError extends Error {
  override readonly name = "ReviewActionError";

  constructor(
    readonly status: 404 | 409 | 422 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const AUDIT_ACTION_BY_REVIEW: Record<ReviewRequest["action"], AuditAction> = {
  confirm: "event-confirmed",
  reject: "event-rejected",
  dispute: "event-disputed",
  "request-evidence": "evidence-requested",
  edit: "event-edited",
  merge: "events-merged",
  separate: "event-separated",
  "confirm-claim": "claim-confirmed",
  "reject-claim": "claim-rejected",
  "pin-priority": "priority-pinned",
  "add-watchlist": "watchlist-added",
};

function allClaims(event: IntelligenceEvent) {
  return [...event.confirmedFacts, ...event.unverifiedClaims, ...event.disputedClaims];
}

function reviewEffect(event: IntelligenceEvent, request: ReviewRequest): unknown {
  switch (request.action) {
    case "confirm":
      return { verificationState: "analyst-confirmed", reviewedBy: request.reviewerName };
    case "reject":
      return { verificationState: "analyst-rejected", status: "rejected" };
    case "dispute":
      return { verificationState: "disputed", status: "disputed" };
    case "request-evidence":
      return { reviewRequired: true, evidenceRequested: true };
    case "edit":
      return request.updates;
    case "merge":
      return { canonicalEventId: event.id, mergedEventIds: request.relatedEventIds };
    case "separate":
      return { eventId: event.id, separatedReportIds: request.reportIds };
    case "confirm-claim":
      return { claimId: request.claimId, status: "confirmed" };
    case "reject-claim":
      return { claimId: request.claimId, status: "rejected" };
    case "pin-priority":
      return { priority: true };
    case "add-watchlist":
      return { watchlistId: request.watchlistId, eventId: event.id };
  }
}

export async function recordReviewAction(
  request: ReviewRequest,
  requestId: string,
  dependencies: {
    provider?: IntelligenceDataProvider;
    recorder?: AuditRecorder;
    occurredAt?: string;
  } = {},
): Promise<{ auditId: string; occurredAt: string; effect: unknown }> {
  const provider = dependencies.provider ?? intelligenceDataProvider;
  const recorder = dependencies.recorder ?? auditRecorder;
  const events = await provider.getEvents();
  const event = events.find((candidate) => candidate.id === request.eventId);
  if (!event) throw new ReviewActionError(404, "event_not_found", "The target event does not exist.");

  if (request.claimId && !allClaims(event).some((claim) => claim.id === request.claimId)) {
    throw new ReviewActionError(404, "claim_not_found", "The target claim does not belong to this event.");
  }
  if (request.relatedEventIds) {
    const uniqueTargets = new Set(request.relatedEventIds);
    if (uniqueTargets.size !== request.relatedEventIds.length || uniqueTargets.has(event.id)) {
      throw new ReviewActionError(422, "invalid_merge_targets", "Merge targets must be unique and exclude the canonical event.");
    }
    if (request.relatedEventIds.some((id) => !events.some((candidate) => candidate.id === id))) {
      throw new ReviewActionError(404, "merge_target_not_found", "At least one merge target does not exist.");
    }
  }
  if (request.reportIds?.some((id) => !event.sourceReportIds.includes(id))) {
    throw new ReviewActionError(409, "report_not_linked", "A selected report is not linked to the target event.");
  }
  if (request.watchlistId) {
    const watchlists = await provider.getWatchlists();
    if (!watchlists.some((watchlist) => watchlist.id === request.watchlistId)) {
      throw new ReviewActionError(404, "watchlist_not_found", "The selected watchlist does not exist.");
    }
  }

  const effect = reviewEffect(event, request);
  const audit = createAuditEntry({
    action: AUDIT_ACTION_BY_REVIEW[request.action],
    targetType: request.claimId ? "claim" : "event",
    targetId: request.claimId ?? event.id,
    actorName: request.reviewerName,
    summary: `${request.reviewerName} recorded ${request.action} for ${event.title}.`,
    requestId,
    before: {
      verificationState: event.verificationState,
      status: event.status,
      priority: event.priority,
    },
    after: effect,
    reason: request.reason,
    occurredAt: dependencies.occurredAt,
  });
  await recorder.record(audit);
  return { auditId: audit.id, occurredAt: audit.occurredAt, effect };
}
