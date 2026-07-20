import type { GitHubOAuthConfiguration } from "@/lib/auth/github-oauth";
import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";

export interface IdentityEnvironment {
  database?: D1DocumentDatabase;
  githubOAuthClientId?: string;
  githubOAuthClientSecret?: string;
  authCallbackUrl?: string;
  authSessionTtlSeconds?: string;
}

function validCallbackUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
      return url.toString();
    }
  } catch {
    // Invalid configuration is treated as disabled rather than exposed to clients.
  }
  return null;
}

export function githubOAuthConfiguration(
  environment: IdentityEnvironment,
): GitHubOAuthConfiguration | null {
  const clientId = environment.githubOAuthClientId?.trim();
  const clientSecret = environment.githubOAuthClientSecret?.trim();
  const callbackUrl = validCallbackUrl(environment.authCallbackUrl);
  if (!environment.database || !clientId || !clientSecret || !callbackUrl) return null;
  return { clientId, clientSecret, callbackUrl };
}

export function authSessionTtlSeconds(value: string | undefined): number {
  const configured = Number(value ?? "28800");
  if (!Number.isFinite(configured)) return 28_800;
  return Math.max(900, Math.min(86_400, Math.trunc(configured)));
}
