import { z } from "zod";
import { requestIdFrom, API_SECURITY_HEADERS, jsonError } from "@/lib/api/responses";
import { validateJsonBody } from "@/lib/api/validation";
import {
  authSessionTtlSeconds,
  githubOAuthConfiguration,
  type IdentityEnvironment,
} from "@/lib/auth/configuration";
import {
  exchangeGitHubIdentity,
  GitHubOAuthError,
} from "@/lib/auth/github-oauth";
import { D1IdentityStore, IdentityStoreError } from "@/lib/auth/identity-store";
import {
  D1RateLimitStore,
  FixedWindowRateLimiter,
  rateLimitHeaders,
  requestRateLimitKey,
} from "@/lib/security/rate-limit";
import type { AuthSessionEstablished } from "@/packages/shared/auth";

const exchangeRequestSchema = z
  .object({
    code: z.string().trim().min(8).max(512).regex(/^[A-Za-z0-9_-]+$/),
    codeVerifier: z.string().min(43).max(128).regex(/^[A-Za-z0-9._~-]+$/),
  })
  .strict();

export interface AuthExchangeContext extends IdentityEnvironment {
  exchangeIdentity?: typeof exchangeGitHubIdentity;
}

function sessionEstablishedResponse(
  data: AuthSessionEstablished,
  requestId: string,
  headers: HeadersInit,
): Response {
  const responseHeaders = new Headers(API_SECURITY_HEADERS);
  new Headers(headers).forEach((value, key) => responseHeaders.set(key, value));
  // This is the only API response intentionally carrying an opaque credential.
  // The normal JSON serializer redacts token-shaped fields by design.
  return new Response(JSON.stringify({ data, meta: { requestId } }), {
    status: 201,
    headers: responseHeaders,
  });
}

export async function POST(
  request: Request,
  context: AuthExchangeContext = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const configuration = githubOAuthConfiguration(context);
  if (!configuration || !context.database) {
    return jsonError(503, "identity_disabled", "GitHub identity is not configured.", { requestId });
  }

  let headers: HeadersInit;
  try {
    const rateLimit = await new FixedWindowRateLimiter(
      new D1RateLimitStore(context.database),
      8,
      300_000,
    ).check(requestRateLimitKey(request, "oauth-exchange"));
    headers = rateLimitHeaders(rateLimit);
    if (!rateLimit.allowed) {
      return jsonError(429, "rate_limited", "Too many sign-in attempts.", {
        requestId,
        headers,
      });
    }
  } catch {
    return jsonError(503, "identity_store_unavailable", "Identity controls are unavailable.", {
      requestId,
    });
  }

  const body = await validateJsonBody(request, exchangeRequestSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers,
    });
  }
  try {
    const profile = await (context.exchangeIdentity ?? exchangeGitHubIdentity)(
      body.data,
      configuration,
    );
    const session = await new D1IdentityStore(context.database).createGitHubSession(
      profile,
      authSessionTtlSeconds(context.authSessionTtlSeconds),
    );
    return sessionEstablishedResponse(session, requestId, headers);
  } catch (error) {
    if (error instanceof GitHubOAuthError) {
      return jsonError(401, error.code, error.message, { requestId, headers });
    }
    if (error instanceof IdentityStoreError) {
      return jsonError(error.status, error.code, error.message, { requestId, headers });
    }
    return jsonError(503, "sign_in_failed", "ARGUS could not establish the identity session.", {
      requestId,
      headers,
    });
  }
}
