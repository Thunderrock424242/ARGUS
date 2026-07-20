import { requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { jsonData, requestIdFrom } from "@/lib/api/responses";

export async function GET(
  request: Request,
  context: AuthorizationContext = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "profile:read", "profile-read", requestId, context);
  if (!guard.authorized) return guard.response;
  return jsonData(
    { principal: guard.principal },
    { headers: guard.rateLimitHeaders, meta: { requestId } },
  );
}
