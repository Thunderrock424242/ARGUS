import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getEvents } from "@/app/api/events/route";
import { GET as getEvent } from "@/app/api/events/[slug]/route";
import { GET as getReports } from "@/app/api/reports/route";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as search } from "@/app/api/search/route";
import { POST as review } from "@/app/api/admin/review/route";
import { POST as runCollector } from "@/app/api/admin/collectors/run/route";
import { demoEvents, demoSources } from "@/packages/shared/demo-data";

interface ApiTestPayload {
  data?: unknown;
  meta?: Record<string, unknown>;
  error?: { code?: string };
}

async function body(response: Response): Promise<ApiTestPayload> {
  return (await response.json()) as ApiTestPayload;
}

describe.sequential("ARGUS API routes", () => {
  const previousToken = process.env.ARGUS_ADMIN_TOKEN;
  const adminToken = "test-only-admin-token-with-sufficient-entropy";

  beforeAll(() => {
    delete process.env.ARGUS_ADMIN_TOKEN;
  });

  afterAll(() => {
    if (previousToken === undefined) delete process.env.ARGUS_ADMIN_TOKEN;
    else process.env.ARGUS_ADMIN_TOKEN = previousToken;
  });

  it("returns paginated, explicitly labeled event data", async () => {
    const response = await getEvents(new Request("https://argus.example/api/events?limit=2"));
    const payload = await body(response);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(payload.data as unknown[]).toHaveLength(2);
    expect(payload.meta?.total).toBeGreaterThanOrEqual(24);
    expect(payload.meta?.demoDataLabel).toContain("Demonstration data");
  });

  it("rejects ambiguous or out-of-range event query parameters", async () => {
    const response = await getEvents(
      new Request("https://argus.example/api/events?limit=101&unknown=true"),
    );
    const payload = await body(response);
    expect(response.status).toBe(422);
    expect(payload.error?.code).toBe("invalid_query");
  });

  it("returns an event dossier by slug and a typed not-found response", async () => {
    const event = demoEvents[0];
    const found = await getEvent(
      new Request(`https://argus.example/api/events/${event.slug}`),
      { params: Promise.resolve({ slug: event.slug }) },
    );
    expect(found.status).toBe(200);
    expect(((await body(found)).data as { id: string }).id).toBe(event.id);

    const missing = await getEvent(
      new Request("https://argus.example/api/events/not-a-real-event"),
      { params: Promise.resolve({ slug: "not-a-real-event" }) },
    );
    expect(missing.status).toBe(404);
  });

  it("does not expose raw collector payloads from the reports list", async () => {
    const response = await getReports(new Request("https://argus.example/api/reports?limit=1"));
    const payload = await body(response);
    expect(response.status).toBe(200);
    expect((payload.data as Record<string, unknown>[])[0]).not.toHaveProperty("rawPayload");
    expect(payload.meta?.rawPayloadsIncluded).toBe(false);
  });

  it("searches the provider and health-checks its read surfaces", async () => {
    const query = encodeURIComponent(demoEvents[0].title.split(/\s+/).slice(0, 2).join(" "));
    const searchResponse = await search(
      new Request(`https://argus.example/api/search?q=${query}&type=event`),
    );
    expect(searchResponse.status).toBe(200);
    expect(((await body(searchResponse)).data as unknown[]).length).toBeGreaterThan(0);

    const healthResponse = await getHealth(new Request("https://argus.example/api/health"));
    const health = await body(healthResponse);
    expect(healthResponse.status).toBe(200);
    const healthData = health.data as {
      status: string;
      services: { collectors: { networkCollectionEnabledFromApi: boolean } };
    };
    expect(healthData.status).toBe("operational");
    expect(healthData.services.collectors.networkCollectionEnabledFromApi).toBe(false);
  });

  it("keeps administrative review unavailable until a token is configured", async () => {
    const response = await review(
      new Request("https://argus.example/api/admin/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          eventId: demoEvents[0].id,
          reviewerName: "Test Analyst",
        }),
      }),
    );
    expect(response.status).toBe(503);
    expect((await body(response)).error?.code).toBe("admin_disabled");
  });

  it("validates and audit-records an authorized review without claiming durable mutation", async () => {
    process.env.ARGUS_ADMIN_TOKEN = adminToken;
    const response = await review(
      new Request("https://argus.example/api/admin/review", {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "confirm",
          eventId: demoEvents[0].id,
          reviewerName: "Test Analyst",
        }),
      }),
    );
    const payload = await body(response);
    expect(response.status).toBe(202);
    const reviewData = payload.data as { status: string; canonicalDataMutated: boolean };
    expect(reviewData.status).toBe("recorded");
    expect(reviewData.canonicalDataMutated).toBe(false);
    expect(JSON.stringify(payload)).not.toContain(adminToken);
  });

  it("runs only a registered dry-run collector from the admin API", async () => {
    process.env.ARGUS_ADMIN_TOKEN = adminToken;
    const source = demoSources.find((candidate) => candidate.enabled) ?? demoSources[0];
    const response = await runCollector(
      new Request("https://argus.example/api/admin/collectors/run", {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          collectorId: "rss-atom",
          sourceId: source.id,
          analystName: "Test Analyst",
          mode: "dry-run",
        }),
      }),
    );
    const payload = await body(response);
    expect(response.status).toBe(202);
    const collectorData = payload.data as { networkAccessed: boolean; reports: unknown[] };
    expect(collectorData.networkAccessed).toBe(false);
    expect(collectorData.reports).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain(adminToken);
  });
});
