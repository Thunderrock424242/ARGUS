import { requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { readCollectorPilotStatus } from "@/packages/database/collector-pilot";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: AuthorizationContext = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "collectors:run", "collector-status", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database || !context.collectorConfig) {
    return jsonError(503, "collector_runtime_unavailable", "The durable collector pilot is not configured.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  try {
    return jsonData(await readCollectorPilotStatus(context.database, context.collectorConfig), {
      headers: guard.rateLimitHeaders,
      meta: {
        requestId,
        notice: "Collected public information is visible at 25% confidence until an explicit review or administrator adjustment.",
      },
    });
  } catch {
    return jsonError(503, "collector_status_unavailable", "Collector status could not be loaded.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}
