import { requirePermission } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { auditLogQuerySchema } from "@/lib/api/schemas";
import { validateSearchParams } from "@/lib/api/validation";
import { readAuditLogPage } from "@/packages/database/audit-log-reader";
import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";

interface AuditRouteContext {
  adminToken?: string;
  database?: D1DocumentDatabase;
}

export async function GET(request: Request, context: AuditRouteContext = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "events:review", "audit-read", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) return jsonError(503, "durable_store_unavailable", "D1 is required for audit reads.", { requestId, headers: guard.rateLimitHeaders });
  const query = validateSearchParams(new URL(request.url).searchParams, auditLogQuerySchema);
  if (!query.success) return jsonError(query.status, query.code, query.message, { details: query.details, requestId, headers: guard.rateLimitHeaders });
  try {
    const result = await readAuditLogPage(context.database, query.data);
    return jsonData(result.entries, {
      headers: guard.rateLimitHeaders,
      meta: { requestId, page: query.data.page, limit: query.data.limit, hasMore: result.hasMore },
    });
  } catch {
    return jsonError(503, "audit_unavailable", "The audit history could not be loaded.", { requestId, headers: guard.rateLimitHeaders });
  }
}
