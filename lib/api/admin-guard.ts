import { D1IdentityStore } from "@/lib/auth/identity-store";
import { bearerCredential, isSessionCredential } from "@/lib/auth/tokens";
import { authorizeAdminRequest } from "@/lib/security/admin-auth";
import {
  D1RateLimitStore,
  FixedWindowRateLimiter,
  rateLimitHeaders,
  requestRateLimitKey,
} from "@/lib/security/rate-limit";
import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";
import {
  ARGUS_PERMISSIONS,
  type ArgusPermission,
  type AuthPrincipal,
  principalHasPermission,
} from "@/packages/shared/auth";
import { jsonError } from "./responses";

export interface AuthorizationContext {
  adminToken?: string;
  database?: D1DocumentDatabase;
}

export type AdminGuardResult =
  | { authorized: true; principal: AuthPrincipal; rateLimitHeaders: HeadersInit }
  | { authorized: false; response: Response };

const BOOTSTRAP_PRINCIPAL: AuthPrincipal = {
  id: "bootstrap:admin-token",
  provider: "bootstrap",
  login: "deployment-operator",
  displayName: "Deployment Operator",
  roles: ["administrator"],
  permissions: [...ARGUS_PERMISSIONS],
  authMethod: "bootstrap-token",
};

export function actorForRequest(
  principal: AuthPrincipal,
  claimedName?: string,
): { id: string; name: string } {
  return {
    id: principal.id,
    name:
      principal.authMethod === "bootstrap-token" && claimedName?.trim()
        ? claimedName.trim()
        : principal.displayName,
  };
}

export async function requirePermission(
  request: Request,
  permission: ArgusPermission,
  scope: string,
  requestId: string,
  context: AuthorizationContext = {},
): Promise<AdminGuardResult> {
  if (!context.database) {
    return {
      authorized: false,
      response: jsonError(
        503,
        "admin_disabled",
        "Administrative routes require the durable identity store.",
        { requestId },
      ),
    };
  }

  let headers: HeadersInit;
  try {
    const rateLimit = await new FixedWindowRateLimiter(
      new D1RateLimitStore(context.database),
      60,
      60_000,
    ).check(requestRateLimitKey(request, scope));
    headers = rateLimitHeaders(rateLimit);
    if (!rateLimit.allowed) {
      return {
        authorized: false,
        response: jsonError(429, "rate_limited", "Too many protected requests.", {
          requestId,
          headers,
        }),
      };
    }
  } catch {
    return {
      authorized: false,
      response: jsonError(
        503,
        "identity_store_unavailable",
        "The durable identity controls are unavailable.",
        { requestId },
      ),
    };
  }

  const credential = bearerCredential(request);
  let principal: AuthPrincipal | null = null;
  const configuredAdminToken = context.adminToken ?? process.env.ARGUS_ADMIN_TOKEN;
  if (credential && configuredAdminToken) {
    const bootstrap = authorizeAdminRequest(request, configuredAdminToken);
    if (bootstrap.authorized) principal = BOOTSTRAP_PRINCIPAL;
  }
  if (!principal && credential && isSessionCredential(credential)) {
    try {
      principal = await new D1IdentityStore(context.database).authenticateSession(credential);
    } catch {
      return {
        authorized: false,
        response: jsonError(
          503,
          "identity_store_unavailable",
          "The identity session could not be verified.",
          { requestId, headers },
        ),
      };
    }
  }

  if (!principal) {
    return {
      authorized: false,
      response: jsonError(401, "unauthorized", "A valid ARGUS identity session is required.", {
        requestId,
        headers: {
          ...Object.fromEntries(new Headers(headers)),
          "www-authenticate": 'Bearer realm="ARGUS"',
        },
      }),
    };
  }
  try {
    const principalLimit = await new FixedWindowRateLimiter(
      new D1RateLimitStore(context.database),
      30,
      60_000,
    ).check(`${scope}:principal:${principal.id}`);
    headers = rateLimitHeaders(principalLimit);
    if (!principalLimit.allowed) {
      return {
        authorized: false,
        response: jsonError(429, "rate_limited", "Too many protected requests for this identity.", {
          requestId,
          headers,
        }),
      };
    }
  } catch {
    return {
      authorized: false,
      response: jsonError(503, "identity_store_unavailable", "Identity controls are unavailable.", {
        requestId,
        headers,
      }),
    };
  }
  if (!principalHasPermission(principal, permission)) {
    return {
      authorized: false,
      response: jsonError(403, "forbidden", `The ${permission} permission is required.`, {
        requestId,
        headers,
      }),
    };
  }
  return { authorized: true, principal, rateLimitHeaders: headers };
}
