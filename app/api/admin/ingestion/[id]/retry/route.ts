import { actorForRequest, requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { ingestionRetrySchema, routeIdentifierSchema } from "@/lib/api/schemas";
import { validateJsonBody } from "@/lib/api/validation";
import { IngestionStoreError, retryIngestionSubmission } from "@/packages/database/ingestion-store";

interface IngestionRetryContext extends AuthorizationContext {
  params?: Promise<{ id: string }>;
}

export async function POST(request: Request, context: IngestionRetryContext = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "ingestion:retry", "ingestion-retry", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) {
    return jsonError(503, "durable_store_unavailable", "D1 is required for ingestion retries.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  const id = routeIdentifierSchema.safeParse((await context.params)?.id);
  if (!id.success) {
    return jsonError(422, "invalid_identifier", "The ingestion submission identifier is invalid.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  const body = await validateJsonBody(request, ingestionRetrySchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  try {
    const submission = await retryIngestionSubmission(context.database, {
      id: id.data,
      ...body.data,
      actor: actorForRequest(guard.principal),
      requestId,
    });
    return jsonData(submission, {
      headers: guard.rateLimitHeaders,
      meta: { requestId, durability: "d1" },
    });
  } catch (error) {
    if (error instanceof IngestionStoreError) {
      return jsonError(error.status, error.code, error.message, {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    return jsonError(503, "ingestion_retry_failed", "The ingestion retry could not be saved.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}
