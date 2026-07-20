import { requirePermission } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { READ_MODEL_COLLECTIONS, readModelCollection, type D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";
import type { MonitoringLayout } from "@/packages/shared/types";

interface LayoutsRouteContext {
  adminToken?: string;
  database?: D1DocumentDatabase;
}

export async function GET(request: Request, context: LayoutsRouteContext = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "layouts:write", "monitoring-layout-read", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) return jsonError(503, "durable_store_unavailable", "D1 is required for monitoring layout reads.", { requestId, headers: guard.rateLimitHeaders });
  try {
    const layouts = await readModelCollection<MonitoringLayout>(context.database, READ_MODEL_COLLECTIONS.monitoringLayouts);
    return jsonData(layouts.filter((layout) => layout.ownerId === guard.principal.id), {
      headers: guard.rateLimitHeaders,
      meta: { requestId, ownerId: guard.principal.id },
    });
  } catch {
    return jsonError(503, "layout_read_failed", "Monitoring layouts could not be loaded.", { requestId, headers: guard.rateLimitHeaders });
  }
}
