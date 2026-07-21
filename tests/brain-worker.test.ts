import { describe, expect, it } from "vitest";
import worker from "@/worker/index";
import { demoEvents, demoSources } from "@/packages/shared/demo-data";
import { FakeD1Database } from "./helpers/fake-d1";

const env = { ALLOWED_ORIGINS: "https://thunderrock424242.github.io" };

describe("standalone ARGUS brain Worker", () => {
  it("serves the public API to the GitHub Pages origin", async () => {
    const response = await worker.fetch(
      new Request("https://argus-brain.example/api/health", {
        headers: { origin: "https://thunderrock424242.github.io" },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://thunderrock424242.github.io",
    );
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(response.headers.get("x-argus-data-store")).toBe("fixtures");
  });

  it("rejects unapproved browser origins", async () => {
    const response = await worker.fetch(
      new Request("https://argus-brain.example/api/events", {
        headers: { origin: "https://malicious.example" },
      }),
      env,
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("runs Aether remotely against stored demonstration evidence", async () => {
    const response = await worker.fetch(
      new Request("https://argus-brain.example/api/aether", {
        method: "POST",
        headers: {
          origin: "https://thunderrock424242.github.io",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: "Explain the confidence score.",
          contextEventIds: [demoEvents[0].id],
        }),
      }),
      env,
    );
    const payload = (await response.json()) as {
      data: { answer: string; relatedEventIds: string[] };
    };
    expect(response.status).toBe(200);
    expect(payload.data.answer).toContain("Aether-generated demonstration analysis");
    expect(payload.data.relatedEventIds).toContain(demoEvents[0].id);
  });

  it("keeps administrative routes disabled without a configured token and D1", async () => {
    const response = await worker.fetch(
      new Request("https://argus-brain.example/api/admin/review", {
        method: "POST",
        headers: { origin: "https://thunderrock424242.github.io" },
      }),
      env,
    );
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("admin_disabled");
  });

  it("protects and executes D1 administration only with explicit credentials", async () => {
    const database = new FakeD1Database();
    const token = "worker-test-admin-token";
    const response = await worker.fetch(
      new Request("https://argus-brain.example/api/admin/demo-seed", {
        method: "POST",
        headers: {
          origin: "https://thunderrock424242.github.io",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reviewerName: "Deployment Operator",
          confirmation: "seed-demonstration-data",
        }),
      }),
      { ...env, ARGUS_ADMIN_TOKEN: token, DB: database },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("x-argus-data-store")).toBe("d1");
    expect(database.readModels.size).toBeGreaterThan(100);
    expect(database.auditRows).toHaveLength(1);
  });

  it("disables fixture fallback and demonstration seeding with the deployment flag", async () => {
    const database = new FakeD1Database();
    const token = "worker-demo-disabled-admin-token";
    const disabledEnv = {
      ...env,
      ARGUS_ADMIN_TOKEN: token,
      ARGUS_DEMO_ENABLED: "false",
      DB: database,
    };
    const snapshot = await worker.fetch(
      new Request("https://argus-brain.example/api/operations/snapshot", {
        headers: { origin: "https://thunderrock424242.github.io" },
      }),
      disabledEnv,
    );
    const snapshotPayload = await snapshot.json() as { data: { events: unknown[]; reports: unknown[] }; meta: { demoDataEnabled: boolean } };
    expect(snapshot.status).toBe(200);
    expect(snapshot.headers.get("x-argus-demo-enabled")).toBe("false");
    expect(snapshotPayload.data.events).toEqual([]);
    expect(snapshotPayload.data.reports).toEqual([]);
    expect(snapshotPayload.meta.demoDataEnabled).toBe(false);

    const seed = await worker.fetch(
      new Request("https://argus-brain.example/api/admin/demo-seed", {
        method: "POST",
        headers: {
          origin: "https://thunderrock424242.github.io",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reviewerName: "Deployment Operator", confirmation: "seed-demonstration-data" }),
      }),
      disabledEnv,
    );
    expect(seed.status).toBe(409);
    expect((await seed.json() as { error: { code: string } }).error.code).toBe("demo_disabled");
    expect(database.readModels.size).toBe(0);
  });

  it("allows authorization headers only through approved-origin preflight", async () => {
    const response = await worker.fetch(
      new Request("https://argus-brain.example/api/admin/review", {
        method: "OPTIONS",
        headers: { origin: "https://thunderrock424242.github.io" },
      }),
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(response.headers.get("access-control-allow-methods")).toContain("PUT");
  });

  it("serves the read-only operations graph from the public brain", async () => {
    const response = await worker.fetch(new Request("https://argus-brain.example/api/relationships?minConfidence=70", { headers: { origin: "https://thunderrock424242.github.io" } }), env);
    const payload = (await response.json()) as { data: { relationships: unknown[] }; meta: { warning: string } };
    expect(response.status).toBe(200);
    expect(payload.data.relationships.length).toBeGreaterThan(0);
    expect(payload.meta.warning).toContain("causation");
  });

  it("mounts the protected ingestion queue through the standalone Worker", async () => {
    const database = new FakeD1Database();
    const token = "worker-ingestion-admin-token";
    const response = await worker.fetch(
      new Request("https://argus-brain.example/api/admin/ingestion", {
        method: "POST",
        headers: {
          origin: "https://thunderrock424242.github.io",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceId: demoSources.find((source) => source.enabled)?.id ?? demoSources[0].id,
          url: "https://example.org/argus/worker-ingestion",
          title: "Worker route ingestion demonstration report",
          description: "Fictional evidence submitted through the Worker routing layer.",
          publishedAt: "2042-03-11T12:00:00.000Z",
        }),
      }),
      { ...env, ARGUS_ADMIN_TOKEN: token, DB: database },
    );
    const payload = await response.json() as { data: { status: string; recordVersion: number } };
    expect(response.status).toBe(201);
    expect(response.headers.get("x-argus-data-store")).toBe("d1");
    expect(payload.data).toMatchObject({ status: "needs-review", recordVersion: 1 });
    expect(database.auditRows.at(-1)?.[5]).toBe("ingestion-submitted");
  });

  it("exposes redacted collector readiness through the protected Worker route", async () => {
    const database = new FakeD1Database();
    const token = "worker-collector-admin-token";
    const response = await worker.fetch(
      new Request("https://argus-brain.example/api/admin/collectors", {
        headers: {
          origin: "https://thunderrock424242.github.io",
          authorization: `Bearer ${token}`,
        },
      }),
      { ...env, ARGUS_ADMIN_TOKEN: token, DB: database },
    );
    const payload = await response.json() as { data: { enabled: boolean; sources: Array<{ credentialConfigured: boolean }> } };
    expect(response.status).toBe(200);
    expect(payload.data.enabled).toBe(false);
    expect(payload.data.sources).toHaveLength(3);
    expect(JSON.stringify(payload)).not.toContain(token);
  });
});
