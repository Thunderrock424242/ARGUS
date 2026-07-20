import { actorForRequest, requirePermission } from "@/lib/api/admin-guard";
import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateJsonBody } from "@/lib/api/validation";
import { reviewRequestSchema } from "@/lib/admin/review";
import {
  DurableOperationError,
  recordDurableEventReview,
} from "@/packages/database/durable-operations";
import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";

export const dynamic = "force-dynamic";

interface ReviewRouteContext {
  adminToken?: string;
  database?: D1DocumentDatabase;
}

export async function POST(
  request: Request,
  context: ReviewRouteContext = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "events:review", "review", requestId, context);
  if (!guard.authorized) return guard.response;

  if (!context.database) {
    return jsonError(503, "durable_store_unavailable", "D1 is required for analyst review writes.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }

  const body = await validateJsonBody(request, reviewRequestSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }

  try {
    const actor = actorForRequest(guard.principal, body.data.reviewerName);
    const result = await recordDurableEventReview(
      context.database,
      { ...body.data, reviewerName: actor.name },
      requestId,
      actor.id,
    );
    return jsonData(
      {
        status: "recorded",
        auditId: result.audit.id,
        occurredAt: result.audit.occurredAt,
        event: result.event,
        durability: "d1",
        canonicalDataMutated: true,
        dataClassification: "demonstration",
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      },
      {
        status: 200,
        headers: guard.rateLimitHeaders,
        meta: {
          requestId,
          notice: "The read model, historical state, and audit entry were committed in one D1 batch.",
        },
      },
    );
  } catch (error) {
    if (error instanceof DurableOperationError) {
      return jsonError(error.status, error.code, error.message, {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    return jsonError(503, "review_unavailable", "The review action could not be recorded.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}
