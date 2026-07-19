import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { safeJsonValue } from "@/lib/api/responses";
import { validateJsonBody } from "@/lib/api/validation";
import {
  authorizeAdminRequest,
  constantTimeTokenEqual,
} from "@/lib/security/admin-auth";
import {
  assertPublicHttpUrl,
  assertPublicResolvedUrl,
  PublicUrlValidationError,
} from "@/lib/security/public-url";
import { FixedWindowRateLimiter, MemoryRateLimitStore } from "@/lib/security/rate-limit";

describe("API security primitives", () => {
  const originalAdminToken = process.env.ARGUS_ADMIN_TOKEN;

  afterEach(() => {
    if (originalAdminToken === undefined) delete process.env.ARGUS_ADMIN_TOKEN;
    else process.env.ARGUS_ADMIN_TOKEN = originalAdminToken;
  });

  it("redacts credential-shaped fields before JSON serialization", () => {
    expect(
      safeJsonValue({
        status: "ok",
        nested: {
          apiKey: "do-not-return",
          authorization: "Bearer do-not-return",
          harmless: "visible",
        },
      }),
    ).toEqual({
      status: "ok",
      nested: {
        apiKey: "[REDACTED]",
        authorization: "[REDACTED]",
        harmless: "visible",
      },
    });
  });

  it("uses a fixed-length constant-time comparison for admin tokens", () => {
    expect(constantTimeTokenEqual("correct-token", "correct-token")).toBe(true);
    expect(constantTimeTokenEqual("wrong", "correct-token")).toBe(false);
  });

  it("keeps admin routes disabled without a configured secret", () => {
    delete process.env.ARGUS_ADMIN_TOKEN;
    const request = new Request("https://argus.example/api/admin/review", {
      headers: { authorization: "Bearer guessed" },
    });
    expect(authorizeAdminRequest(request)).toEqual({ authorized: false, reason: "disabled" });
  });

  it("accepts only an exact bearer token when administration is enabled", () => {
    process.env.ARGUS_ADMIN_TOKEN = "server-only-token";
    expect(
      authorizeAdminRequest(
        new Request("https://argus.example/api/admin/review", {
          headers: { authorization: "Bearer server-only-token" },
        }),
      ),
    ).toEqual({ authorized: true });
    expect(
      authorizeAdminRequest(
        new Request("https://argus.example/api/admin/review", {
          headers: { authorization: "Bearer server-only-token-extra" },
        }),
      ),
    ).toEqual({ authorized: false, reason: "invalid" });
  });

  it.each([
    "http://localhost/feed.xml",
    "http://127.0.0.1/feed.xml",
    "http://169.254.169.254/latest/meta-data",
    "http://10.4.2.1/feed.xml",
    "http://[::1]/feed.xml",
    "http://[fe80::1]/feed.xml",
    "http://user:password@example.com/feed.xml",
    "ftp://example.com/feed.xml",
    "https://example.com:8443/feed.xml",
  ])("rejects unsafe collector URL %s", (value) => {
    expect(() => assertPublicHttpUrl(value)).toThrow(PublicUrlValidationError);
  });

  it("accepts a normal public HTTPS URL", () => {
    expect(assertPublicHttpUrl("https://feeds.example.com/alerts.xml").hostname).toBe(
      "feeds.example.com",
    );
  });

  it("rejects a public hostname when DNS returns any private address", async () => {
    await expect(
      assertPublicResolvedUrl("https://feeds.example.com/alerts.xml", async () => [
        "203.0.114.10",
        "192.168.1.5",
      ]),
    ).rejects.toMatchObject({ code: "forbidden-address" });
  });

  it("enforces fixed-window rate limits through a replaceable store", async () => {
    const limiter = new FixedWindowRateLimiter(new MemoryRateLimitStore(), 2, 60_000);
    expect((await limiter.check("client", 120_000)).allowed).toBe(true);
    expect((await limiter.check("client", 120_001)).allowed).toBe(true);
    const denied = await limiter.check("client", 120_002);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it("rejects unknown write fields and unsupported content types", async () => {
    const schema = z.object({ action: z.literal("confirm") }).strict();
    const invalid = await validateJsonBody(
      new Request("https://argus.example/api/admin/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm", unexpected: true }),
      }),
      schema,
    );
    expect(invalid).toMatchObject({ success: false, status: 422, code: "invalid_body" });

    const wrongType = await validateJsonBody(
      new Request("https://argus.example/api/admin/review", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
      schema,
    );
    expect(wrongType).toMatchObject({
      success: false,
      status: 415,
      code: "unsupported_media_type",
    });
  });
});
