import { requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { D1IdentityStore } from "@/lib/auth/identity-store";

export async function GET(
  request: Request,
  context: AuthorizationContext = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "identity:manage", "identity-list", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) {
    return jsonError(503, "identity_store_unavailable", "D1 is required for identity management.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  try {
    const users = await new D1IdentityStore(context.database).listUsers();
    return jsonData({ users }, { headers: guard.rateLimitHeaders, meta: { requestId } });
  } catch {
    return jsonError(503, "identity_list_failed", "ARGUS could not load identities.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}
