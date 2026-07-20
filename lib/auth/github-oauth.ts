import { z } from "zod";
import type { GitHubIdentityProfile } from "@/lib/auth/identity-store";

const tokenResponseSchema = z.object({
  access_token: z.string().min(20).max(512),
  token_type: z.string().toLowerCase().pipe(z.literal("bearer")),
  scope: z.string().max(2_000).default(""),
});

const profileResponseSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1).max(100).regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/),
  name: z.string().max(200).nullable().optional(),
  avatar_url: z.string().url().max(2_000).nullable().optional(),
});

export interface GitHubOAuthConfiguration {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export class GitHubOAuthError extends Error {
  override readonly name = "GitHubOAuthError";

  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const GITHUB_API_VERSION = "2026-03-10";

function outboundHeaders(accessToken?: string): Headers {
  const headers = new Headers({
    accept: "application/vnd.github+json",
    "user-agent": "ARGUS/0.1",
    "x-github-api-version": GITHUB_API_VERSION,
  });
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  return headers;
}

async function revokeTemporaryToken(
  accessToken: string,
  configuration: GitHubOAuthConfiguration,
  fetcher: typeof fetch,
): Promise<void> {
  try {
    await fetcher(
      `https://api.github.com/applications/${encodeURIComponent(configuration.clientId)}/token`,
      {
        method: "DELETE",
        headers: {
          ...Object.fromEntries(outboundHeaders()),
          authorization: `Basic ${btoa(`${configuration.clientId}:${configuration.clientSecret}`)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    // The token remains only at GitHub if revocation is temporarily unavailable;
    // ARGUS never persists or returns it.
  }
}

export async function exchangeGitHubIdentity(
  input: { code: string; codeVerifier: string },
  configuration: GitHubOAuthConfiguration,
  fetcher: typeof fetch = fetch,
): Promise<GitHubIdentityProfile> {
  const tokenResponse = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "ARGUS/0.1",
    },
    body: new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      code: input.code,
      redirect_uri: configuration.callbackUrl,
      code_verifier: input.codeVerifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) {
    throw new GitHubOAuthError("oauth_exchange_rejected", "GitHub rejected the authorization code.");
  }
  const tokenParsed = tokenResponseSchema.safeParse(await tokenResponse.json());
  if (!tokenParsed.success) {
    throw new GitHubOAuthError("oauth_exchange_invalid", "GitHub returned an invalid token response.");
  }
  const accessToken = tokenParsed.data.access_token;
  try {
    if (tokenParsed.data.scope.trim()) {
      throw new GitHubOAuthError(
        "oauth_scope_rejected",
        "ARGUS accepts identity-only GitHub authorization without repository scopes.",
      );
    }
    const profileResponse = await fetcher("https://api.github.com/user", {
      headers: outboundHeaders(accessToken),
      signal: AbortSignal.timeout(10_000),
    });
    if (!profileResponse.ok) {
      throw new GitHubOAuthError("identity_lookup_failed", "GitHub did not return the authenticated identity.");
    }
    const profile = profileResponseSchema.safeParse(await profileResponse.json());
    if (!profile.success) {
      throw new GitHubOAuthError("identity_response_invalid", "GitHub returned an invalid identity response.");
    }
    return {
      id: profile.data.id,
      login: profile.data.login,
      name: profile.data.name,
      avatarUrl: profile.data.avatar_url,
    };
  } finally {
    await revokeTemporaryToken(accessToken, configuration, fetcher);
  }
}
