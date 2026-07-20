import { requireAdmin } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { retentionRequestSchema } from "@/lib/api/schemas";
import { validateJsonBody } from "@/lib/api/validation";
import { DurableOperationError, enforceReadModelRetention } from "@/packages/database/durable-operations";
import type { D1DocumentDatabase, ReadModelCollection } from "@/packages/database/d1-read-model-provider";

interface RetentionRouteContext {
  adminToken?: string;
  database?: D1DocumentDatabase;
}

export async function POST(request: Request, context: RetentionRouteContext = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requireAdmin(request, "retention", requestId, context.adminToken);
  if (!guard.authorized) return guard.response;
  if (!context.database) return jsonError(503, "durable_store_unavailable", "D1 is required for retention enforcement.", { requestId, headers: guard.rateLimitHeaders });
  const body = await validateJsonBody(request, retentionRequestSchema);
  if (!body.success) return jsonError(body.status, body.code, body.message, { details: body.details, requestId, headers: guard.rateLimitHeaders });
  try {
    const result = await enforceReadModelRetention(context.database, body.data.before, body.data.collections as ReadModelCollection[] | undefined, { actorName: body.data.reviewerName, requestId });
    return jsonData({ ...result, durability: "d1", requestedBy: body.data.reviewerName }, { headers: guard.rateLimitHeaders, meta: { requestId } });
  } catch (error) {
    if (error instanceof DurableOperationError) return jsonError(error.status, error.code, error.message, { requestId, headers: guard.rateLimitHeaders });
    return jsonError(503, "retention_failed", "The retention policy could not be enforced.", { requestId, headers: guard.rateLimitHeaders });
  }
}
