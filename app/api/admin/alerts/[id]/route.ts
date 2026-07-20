import { actorForRequest, requirePermission } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { alertActionRequestSchema, routeIdentifierSchema } from "@/lib/api/schemas";
import { validateJsonBody } from "@/lib/api/validation";
import { DurableOperationError, recordDurableAlertAction } from "@/packages/database/durable-operations";
import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";

interface AlertRouteContext {
  params: Promise<{ id: string }>;
  adminToken?: string;
  database?: D1DocumentDatabase;
}

export async function POST(request: Request, context: AlertRouteContext): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "alerts:act", "alert-action", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) return jsonError(503, "durable_store_unavailable", "D1 is required for alert actions.", { requestId, headers: guard.rateLimitHeaders });
  const id = routeIdentifierSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError(422, "invalid_alert_id", "The alert identifier is invalid.", { requestId, headers: guard.rateLimitHeaders });
  const body = await validateJsonBody(request, alertActionRequestSchema);
  if (!body.success) return jsonError(body.status, body.code, body.message, { details: body.details, requestId, headers: guard.rateLimitHeaders });
  try {
    const actor = actorForRequest(guard.principal, body.data.reviewerName);
    const result = await recordDurableAlertAction(context.database, id.data, body.data.action, actor.name, requestId, actor.id, body.data.expectedVersion);
    return jsonData({ ...result, durability: "d1" }, { headers: guard.rateLimitHeaders, meta: { requestId } });
  } catch (error) {
    if (error instanceof DurableOperationError) return jsonError(error.status, error.code, error.message, { requestId, headers: guard.rateLimitHeaders });
    return jsonError(503, "alert_action_failed", "The alert action could not be persisted.", { requestId, headers: guard.rateLimitHeaders });
  }
}
