import { requireAdmin } from "@/lib/api/admin-guard";
import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateJsonBody } from "@/lib/api/validation";
import { recordReviewAction, ReviewActionError, reviewRequestSchema } from "@/lib/admin/review";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requireAdmin(request, "review", requestId);
  if (!guard.authorized) return guard.response;

  const body = await validateJsonBody(request, reviewRequestSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }

  try {
    const result = await recordReviewAction(body.data, requestId);
    return jsonData(
      {
        status: "recorded",
        auditId: result.auditId,
        occurredAt: result.occurredAt,
        proposedEffect: result.effect,
        durability: "process-memory",
        canonicalDataMutated: false,
        dataClassification: "demonstration",
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      },
      {
        status: 202,
        headers: guard.rateLimitHeaders,
        meta: {
          requestId,
          notice: "Connect D1AuditRecorder and a writable provider before enabling durable review mutations.",
        },
      },
    );
  } catch (error) {
    if (error instanceof ReviewActionError) {
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
