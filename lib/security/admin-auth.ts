import { createHash, timingSafeEqual } from "node:crypto";

export type AdminAuthorization =
  | { authorized: true }
  | { authorized: false; reason: "disabled" | "missing" | "invalid" };

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Compares fixed-length digests so token length and early mismatches do not short-circuit. */
export function constantTimeTokenEqual(candidate: string, expected: string): boolean {
  return timingSafeEqual(digest(candidate), digest(expected));
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = authorization.match(/^Bearer ([^\s,]{1,4096})$/i);
  return match?.[1] ?? null;
}

export function authorizeAdminRequest(
  request: Request,
  configuredToken: string | undefined = process.env.ARGUS_ADMIN_TOKEN,
): AdminAuthorization {
  if (!configuredToken || configuredToken.trim().length === 0) {
    return { authorized: false, reason: "disabled" };
  }
  const candidate = bearerToken(request);
  if (!candidate) return { authorized: false, reason: "missing" };
  return constantTimeTokenEqual(candidate, configuredToken)
    ? { authorized: true }
    : { authorized: false, reason: "invalid" };
}
