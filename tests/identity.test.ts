import { describe, expect, it, vi } from "vitest";
import { POST as exchangeSession } from "@/app/api/auth/exchange/route";
import { GET as getSession } from "@/app/api/auth/session/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { PUT as updateRoles } from "@/app/api/admin/users/[id]/roles/route";
import { POST as reviewEvent } from "@/app/api/admin/review/route";
import { exchangeGitHubIdentity } from "@/lib/auth/github-oauth";
import { permissionsForRoles } from "@/packages/shared/auth";
import { demoEvents } from "@/packages/shared/demo-data";
import { seedDemonstrationReadModels } from "@/packages/database/d1-read-model-provider";
import { FakeD1Database } from "./helpers/fake-d1";

const identityConfiguration = {
  githubOAuthClientId: "Ov23liARGUSclient",
  githubOAuthClientSecret: "test-client-secret-not-for-production",
  authCallbackUrl: "https://thunderrock424242.github.io/ARGUS/",
};

async function payload<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("ARGUS identity and role controls", () => {
  it("keeps role capabilities explicit and administrator-only operations isolated", () => {
    expect(permissionsForRoles(["viewer"])).toEqual(["profile:read"]);
    expect(permissionsForRoles(["reviewer"])).toContain("events:review");
    expect(permissionsForRoles(["source-manager"])).toContain("collectors:run");
    expect(permissionsForRoles(["source-manager"])).not.toContain("identity:manage");
    expect(permissionsForRoles(["administrator"])).toContain("identity:manage");
  });

  it("establishes a D1 session, defaults new identities to viewer, and revokes logout", async () => {
    const database = new FakeD1Database();
    const response = await exchangeSession(
      new Request("https://argus.example/api/auth/exchange", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.8" },
        body: JSON.stringify({ code: "github-code-123", codeVerifier: "v".repeat(43) }),
      }),
      {
        ...identityConfiguration,
        database,
        exchangeIdentity: async () => ({
          id: 424242,
          login: "Thunderrock424242",
          name: "Mason",
          avatarUrl: "https://avatars.githubusercontent.com/u/424242",
        }),
      },
    );
    expect(response.status).toBe(201);
    const established = await payload<{
      data: { credential: string; principal: { id: string; roles: string[]; displayName: string } };
    }>(response);
    expect(established.data.credential).toMatch(/^argus_session_/);
    expect(established.data.principal).toMatchObject({
      id: "user:github:424242",
      roles: ["viewer"],
      displayName: "Mason",
    });

    const session = await getSession(
      new Request("https://argus.example/api/auth/session", {
        headers: { authorization: `Bearer ${established.data.credential}` },
      }),
      { database },
    );
    expect(session.status).toBe(200);

    const signedOut = await logout(
      new Request("https://argus.example/api/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${established.data.credential}` },
      }),
      { database },
    );
    expect(signedOut.status).toBe(200);
    const revoked = await getSession(
      new Request("https://argus.example/api/auth/session", {
        headers: { authorization: `Bearer ${established.data.credential}` },
      }),
      { database },
    );
    expect(revoked.status).toBe(401);
  });

  it("denies viewer writes, applies audited role grants, and binds audits to the stable user ID", async () => {
    const database = new FakeD1Database();
    await seedDemonstrationReadModels(database);
    const exchange = await exchangeSession(
      new Request("https://argus.example/api/auth/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "github-code-456", codeVerifier: "x".repeat(43) }),
      }),
      {
        ...identityConfiguration,
        database,
        exchangeIdentity: async () => ({ id: 99, login: "analyst-99", name: "Analyst 99" }),
      },
    );
    const credential = (await payload<{ data: { credential: string } }>(exchange)).data.credential;
    const reviewRequest = () =>
      new Request("https://argus.example/api/admin/review", {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "confirm", eventId: demoEvents[0].id }),
      });
    expect((await reviewEvent(reviewRequest(), { database })).status).toBe(403);

    const bootstrapToken = "bootstrap-admin-token-with-high-entropy";
    const roleResponse = await updateRoles(
      new Request("https://argus.example/api/admin/users/user%3Agithub%3A99/roles", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${bootstrapToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ roles: ["reviewer"], reason: "Approved analyst reviewer access." }),
      }),
      {
        database,
        adminToken: bootstrapToken,
        params: Promise.resolve({ id: "user:github:99" }),
      },
    );
    expect(roleResponse.status).toBe(200);
    const authorizedReview = await reviewEvent(reviewRequest(), { database });
    expect(authorizedReview.status).toBe(200);
    expect(database.auditRows.at(-1)?.[3]).toBe("user:github:99");
    expect(database.auditRows.at(-1)?.[4]).toBe("Analyst 99");
  });

  it("does not allow the final administrator role to be removed", async () => {
    const database = new FakeD1Database();
    const created = await exchangeSession(
      new Request("https://argus.example/api/auth/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "github-code-789", codeVerifier: "z".repeat(43) }),
      }),
      {
        ...identityConfiguration,
        database,
        exchangeIdentity: async () => ({ id: 7, login: "owner", name: "Owner" }),
      },
    );
    expect(created.status).toBe(201);
    const bootstrapToken = "bootstrap-admin-token-with-high-entropy";
    const context = {
      database,
      adminToken: bootstrapToken,
      params: Promise.resolve({ id: "user:github:7" }),
    };
    const request = (roles: string[]) =>
      new Request("https://argus.example/api/admin/users/user%3Agithub%3A7/roles", {
        method: "PUT",
        headers: { authorization: `Bearer ${bootstrapToken}`, "content-type": "application/json" },
        body: JSON.stringify({ roles }),
      });
    expect((await updateRoles(request(["administrator"]), context)).status).toBe(200);
    const removed = await updateRoles(request(["reviewer"]), context);
    expect(removed.status).toBe(409);
    expect((await payload<{ error: { code: string } }>(removed)).error.code).toBe("last_administrator");
  });

  it("uses GitHub only to resolve identity and revokes the temporary OAuth token", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ access_token: `gho_${"a".repeat(36)}`, token_type: "bearer", scope: "" }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: 123, login: "octocat", name: "Octocat", avatar_url: null }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const profile = await exchangeGitHubIdentity(
      { code: "github-code", codeVerifier: "p".repeat(43) },
      {
        clientId: identityConfiguration.githubOAuthClientId,
        clientSecret: identityConfiguration.githubOAuthClientSecret,
        callbackUrl: identityConfiguration.authCallbackUrl,
      },
      fetcher,
    );
    expect(profile).toMatchObject({ id: 123, login: "octocat" });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({ method: "DELETE" });
  });

  it("rejects an OAuth grant carrying repository scopes", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ access_token: `gho_${"b".repeat(36)}`, token_type: "bearer", scope: "repo" }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(
      exchangeGitHubIdentity(
        { code: "github-code", codeVerifier: "q".repeat(43) },
        {
          clientId: identityConfiguration.githubOAuthClientId,
          clientSecret: identityConfiguration.githubOAuthClientSecret,
          callbackUrl: identityConfiguration.authCallbackUrl,
        },
        fetcher,
      ),
    ).rejects.toMatchObject({ code: "oauth_scope_rejected" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
