import { authorizeAdminRequest } from "@/lib/security/admin-auth";
import {
  adminRateLimiter,
  rateLimitHeaders,
  requestRateLimitKey,
} from "@/lib/security/rate-limit";
import { jsonError } from "./responses";

export type AdminGuardResult =
  | { authorized: true; rateLimitHeaders: HeadersInit }
  | { authorized: false; response: Response };

export async function requireAdmin(
  request: Request,
  scope: string,
  requestId: string,
): Promise<AdminGuardResult> {
  const rateLimit = await adminRateLimiter.check(requestRateLimitKey(request, scope));
  const headers = rateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return {
      authorized: false,
      response: jsonError(429, "rate_limited", "Too many administrative requests.", {
        requestId,
        headers,
      }),
    };
  }

  const authorization = authorizeAdminRequest(request);
  if (!authorization.authorized) {
    if (authorization.reason === "disabled") {
      return {
        authorized: false,
        response: jsonError(
          503,
          "admin_disabled",
          "Administrative routes are disabled on this deployment.",
          { requestId, headers },
        ),
      };
    }
    return {
      authorized: false,
      response: jsonError(401, "unauthorized", "Administrative authorization is required.", {
        requestId,
        headers: {
          ...Object.fromEntries(new Headers(headers)),
          "www-authenticate": 'Bearer realm="ARGUS administration"',
        },
      }),
    };
  }

  return { authorized: true, rateLimitHeaders: headers };
}
