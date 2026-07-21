import { actorForRequest, requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { ingestionReviewSchema, routeIdentifierSchema } from "@/lib/api/schemas";
import { validateJsonBody } from "@/lib/api/validation";
import { IngestionStoreError, reviewIngestionSubmission } from "@/packages/database/ingestion-store";
import { intelligenceDataProvider } from "@/packages/database/provider";

interface IngestionReviewContext extends AuthorizationContext {
  params?: Promise<{ id: string }>;
}

export async function POST(request: Request, context: IngestionReviewContext = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "ingestion:review", "ingestion-review", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) {
    return jsonError(503, "durable_store_unavailable", "D1 is required for ingestion review.", {
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
  const body = await validateJsonBody(request, ingestionReviewSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  try {
    if (body.data.eventId) {
      const eventExists = (await intelligenceDataProvider.getEvents()).some(
        (event) => event.id === body.data.eventId,
      );
      if (!eventExists) {
        return jsonError(404, "event_not_found", "The selected event does not exist.", {
          requestId,
          headers: guard.rateLimitHeaders,
        });
      }
    }
    const result = await reviewIngestionSubmission(context.database, {
      id: id.data,
      ...body.data,
      actor: actorForRequest(guard.principal),
      requestId,
    });
    return jsonData(result, {
      headers: guard.rateLimitHeaders,
      meta: {
        requestId,
        durability: "d1",
        canonicalReportCreated: Boolean(result.report),
      },
    });
  } catch (error) {
    if (error instanceof IngestionStoreError) {
      return jsonError(error.status, error.code, error.message, {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    return jsonError(503, "ingestion_review_failed", "The ingestion decision could not be saved.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}
