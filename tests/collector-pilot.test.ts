import { describe, expect, it } from "vitest";
import {
  collectorPilotDefinitions,
  WorkerOfficialCollectorTransport,
  type CollectorPilotConfiguration,
  type CollectorTransport,
} from "@/packages/intelligence";
import {
  readCollectorPilotStatus,
  runCollectorPilotSource,
  runScheduledCollectorPilot,
} from "@/packages/database/collector-pilot";
import { reviewIngestionSubmission } from "@/packages/database/ingestion-store";
import { FakeD1Database } from "./helpers/fake-d1";

const config: CollectorPilotConfiguration = {
  enabled: true,
  usgsEnabled: true,
  guardianEnabled: true,
  xEnabled: true,
  guardianQuery: "world",
  xQuery: "earthquake lang:en -is:retweet",
};

function usgsTransport(): CollectorTransport {
  return {
    async request(request) {
      return {
        status: 200,
        finalUrl: request.url,
        headers: { "content-type": "application/geo+json" },
        securityPolicy: "fixed-official-endpoint",
        body: JSON.stringify({
          features: [{
            id: "usgs-fixture-1",
            properties: {
              title: "M 4.2 - Fixture Ridge",
              place: "Fixture Ridge",
              url: "https://earthquake.usgs.gov/earthquakes/eventpage/usgs-fixture-1",
              time: Date.parse("2099-06-01T12:00:00Z"),
            },
            geometry: { coordinates: [-120.5, 37.2, 5] },
          }],
        }),
      };
    },
  };
}

describe("durable collector pilot", () => {
  it("writes official feed candidates only to the protected public-information queue", async () => {
    const database = new FakeD1Database();
    const definition = collectorPilotDefinitions(config).find((candidate) => candidate.collectorId === "usgs-earthquakes");
    expect(definition).toBeDefined();
    const first = await runCollectorPilotSource(database, definition!, usgsTransport(), {
      scheduledFor: "2099-06-01T12:05:00.000Z",
    });
    expect(first.run).toMatchObject({ status: "succeeded", reportsSeen: 1, reportsInserted: 1, networkAccessed: true });
    expect(database.ingestionSubmissions.size).toBe(1);
    expect([...database.ingestionSubmissions.values()][0]).toMatchObject({
      status: "needs-review",
      dataClassification: "public-information",
    });
    expect(database.auditRows.some((row) => row[2] === "collector" && row[5] === "ingestion-submitted")).toBe(true);
    expect(database.collectorRuns).toHaveLength(1);

    const queued = [...database.ingestionSubmissions.values()][0];
    const approved = await reviewIngestionSubmission(database, {
      id: queued.id,
      decision: "approve",
      reason: "Fixture review confirms source attribution and public-information handling.",
      expectedVersion: queued.version,
      actor: { id: "analyst:fixture", name: "Fixture Analyst" },
      requestId: "fixture-approval",
    });
    expect(approved.report?.dataClassification).toBe("public-information");
    expect(database.readModels.get(`reports:${approved.report?.id}`)?.dataClassification).toBe("public-information");

    const second = await runCollectorPilotSource(database, definition!, usgsTransport(), {
      scheduledFor: "2099-06-01T12:20:00.000Z",
    });
    expect(second.run).toMatchObject({ reportsInserted: 0, duplicatesSkipped: 1 });
    expect(database.ingestionSubmissions.size).toBe(1);
  });

  it("reports missing optional credentials without exposing secret values", async () => {
    const database = new FakeD1Database();
    const status = await readCollectorPilotStatus(database, config);
    expect(status.enabled).toBe(true);
    expect(status.sources.find((source) => source.collectorId === "usgs-earthquakes")?.active).toBe(true);
    expect(status.sources.find((source) => source.collectorId === "guardian-open-platform")).toMatchObject({
      active: false,
      credentialConfigured: false,
    });
    expect(status.sources.find((source) => source.collectorId === "x-recent-search")).toMatchObject({
      active: false,
      credentialConfigured: false,
    });
  });

  it("does not rerun a source before its durable interval is due", async () => {
    const database = new FakeD1Database();
    const first = await runScheduledCollectorPilot(database, config, usgsTransport(), new Date("2099-06-01T12:00:00Z"));
    const second = await runScheduledCollectorPilot(database, config, usgsTransport(), new Date("2099-06-01T12:10:00Z"));
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });
});

describe("Worker official collector transport", () => {
  it("injects Guardian credentials server-side and redacts them from its result", async () => {
    let requestedUrl = "";
    const transport = new WorkerOfficialCollectorTransport({
      guardianApiKey: "guardian-test-secret",
      fetcher: async (input) => {
        requestedUrl = String(input);
        return new Response("{}", { headers: { "content-type": "application/json" } });
      },
    });
    const response = await transport.request({
      url: "https://content.guardianapis.com/search?q=world",
      headers: { accept: "application/json" },
      timeoutMs: 1_000,
      maximumResponseBytes: 1_024,
      redirectPolicy: "error",
    });
    expect(requestedUrl).toContain("api-key=guardian-test-secret");
    expect(JSON.stringify(response)).not.toContain("guardian-test-secret");
    expect(response.securityPolicy).toBe("fixed-official-endpoint");
  });

  it("rejects redirects from an approved host", async () => {
    const transport = new WorkerOfficialCollectorTransport({
      fetcher: async () => new Response(null, { status: 302, headers: { location: "https://example.com" } }),
    });
    await expect(transport.request({
      url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
      headers: { accept: "application/geo+json" },
      timeoutMs: 1_000,
      maximumResponseBytes: 1_024,
      redirectPolicy: "error",
    })).rejects.toThrow(/redirect/i);
  });
});
