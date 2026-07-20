import { requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { jsonData, requestIdFrom } from "@/lib/api/responses";
import { D1IdentityStore } from "@/lib/auth/identity-store";
import { bearerCredential } from "@/lib/auth/tokens";

export async function POST(
  request: Request,
  context: AuthorizationContext = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "profile:read", "logout", requestId, context);
  if (!guard.authorized) return guard.response;
  const credential = bearerCredential(request);
  if (credential && context.database && guard.principal.authMethod === "oauth-session") {
    await new D1IdentityStore(context.database).revokeSession(credential);
  }
  return jsonData(
    { status: "signed-out" },
    { headers: guard.rateLimitHeaders, meta: { requestId } },
  );
}
