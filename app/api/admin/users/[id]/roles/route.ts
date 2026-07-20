import { z } from "zod";
import {
  actorForRequest,
  requirePermission,
  type AuthorizationContext,
} from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateJsonBody } from "@/lib/api/validation";
import { D1IdentityStore, IdentityStoreError } from "@/lib/auth/identity-store";
import { ARGUS_ROLES } from "@/packages/shared/auth";

const roleUpdateSchema = z
  .object({
    roles: z.array(z.enum(ARGUS_ROLES)).min(1).max(ARGUS_ROLES.length),
    reason: z.string().trim().min(3).max(2_000).optional(),
  })
  .strict();

interface RoleRouteContext extends AuthorizationContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RoleRouteContext): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "identity:manage", "identity-role-update", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) {
    return jsonError(503, "identity_store_unavailable", "D1 is required for identity management.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  const body = await validateJsonBody(request, roleUpdateSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  try {
    const actor = actorForRequest(guard.principal);
    const user = await new D1IdentityStore(context.database).replaceRoles(
      (await context.params).id,
      body.data.roles,
      actor,
      requestId,
      body.data.reason,
    );
    return jsonData({ user }, { headers: guard.rateLimitHeaders, meta: { requestId } });
  } catch (error) {
    if (error instanceof IdentityStoreError) {
      return jsonError(error.status, error.code, error.message, {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    return jsonError(503, "role_update_failed", "ARGUS could not update the identity roles.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}
