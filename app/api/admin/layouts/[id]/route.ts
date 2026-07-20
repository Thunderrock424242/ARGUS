import { actorForRequest, requirePermission } from "@/lib/api/admin-guard";
import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { monitoringLayoutSaveSchema, routeIdentifierSchema } from "@/lib/api/schemas";
import { validateJsonBody } from "@/lib/api/validation";
import { saveDurableMonitoringLayout } from "@/packages/database/durable-operations";
import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";

interface LayoutRouteContext {
  params: Promise<{ id: string }>;
  adminToken?: string;
  database?: D1DocumentDatabase;
}

export async function PUT(request: Request, context: LayoutRouteContext): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "layouts:write", "monitoring-layout", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) return jsonError(503, "durable_store_unavailable", "D1 is required for monitoring layout writes.", { requestId, headers: guard.rateLimitHeaders });
  const id = routeIdentifierSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError(422, "invalid_layout_id", "The layout identifier is invalid.", { requestId, headers: guard.rateLimitHeaders });
  const body = await validateJsonBody(request, monitoringLayoutSaveSchema);
  if (!body.success) return jsonError(body.status, body.code, body.message, { details: body.details, requestId, headers: guard.rateLimitHeaders });
  try {
    const actor = actorForRequest(guard.principal, body.data.reviewerName);
    const result = await saveDurableMonitoringLayout(context.database, { id: id.data, name: body.data.name, widgets: body.data.widgets, updatedAt: new Date().toISOString(), dataClassification: "demonstration", demoDataLabel: DEMONSTRATION_DATA_LABEL }, actor.name, requestId, actor.id);
    return jsonData({ ...result, durability: "d1" }, { headers: guard.rateLimitHeaders, meta: { requestId } });
  } catch {
    return jsonError(503, "layout_save_failed", "The monitoring layout could not be persisted.", { requestId, headers: guard.rateLimitHeaders });
  }
}
