import { describe, expect, it } from "vitest";
import {
  DEMONSTRATION_DATA_LABEL,
  demoBriefs,
  demoEvents,
  demoReports,
  demoSources,
  demoWatchlists,
  validateDemoDataRelationships,
} from "@/packages/shared/demo-data";
import type { SourceReport } from "@/packages/shared/types";
import { assessConfidence } from "@/packages/intelligence/confidence";
import { scoreEventCorrelation } from "@/packages/intelligence/correlation";
import { detectDuplicateReport } from "@/packages/intelligence/duplicate-detection";
import { ReportProcessingPipeline } from "@/packages/intelligence/pipeline";
import { MockIntelligenceDataProvider } from "@/packages/database/provider";
import {
  AETHER_DEMO_DISCLOSURE,
  DeterministicAetherProvider,
} from "@/packages/intelligence/aether";
import {
  GuardianOpenPlatformCollector,
  RssAtomCollector,
  XRecentSearchCollector,
  assertPublicHttpsUrl,
} from "@/packages/intelligence/collectors";
import {
  createCollectorJob,
  collectedReportIdempotencyKey,
  earliestRateLimitedRunAt,
  executeCollectorJob,
  exponentialBackoffMs,
  nextScheduledCollectionAt,
} from "@/packages/intelligence/collector-runtime";

describe("ARGUS demonstration fixtures", () => {
  it("provides the requested volume and labels every user-facing record", () => {
    expect(demoEvents.length).toBeGreaterThanOrEqual(24);
    expect(demoReports.length).toBeGreaterThanOrEqual(60);
    expect(demoSources.length).toBeGreaterThanOrEqual(15);
    expect(demoWatchlists.length).toBeGreaterThanOrEqual(10);
    expect(demoBriefs.length).toBeGreaterThanOrEqual(5);
    expect(
      [...demoEvents, ...demoReports, ...demoSources, ...demoWatchlists, ...demoBriefs].every(
        (record) => record.demoDataLabel === DEMONSTRATION_DATA_LABEL,
      ),
    ).toBe(true);
    expect(validateDemoDataRelationships()).toEqual([]);
  });

  it("serves defensive copies through the mock provider", async () => {
    const provider = new MockIntelligenceDataProvider();
    const firstRead = await provider.getEvents();
    firstRead[0].title = "Locally mutated test title";
    const secondRead = await provider.getEvents();

    expect(secondRead[0].title).not.toBe("Locally mutated test title");
    expect(await provider.getEventBySlug(secondRead[0].slug.toLocaleUpperCase("en-US"))).toEqual(
      secondRead[0],
    );
    expect(await provider.getEventBySlug("missing-event")).toBeNull();
  });
});

describe("transparent confidence assessment", () => {
  it("caps automated confidence below certainty and exposes factor evidence", () => {
    const event = demoEvents.find((candidate) => candidate.sourceReportIds.length >= 3) ?? demoEvents[0];
    const reports = demoReports.filter((report) => event.sourceReportIds.includes(report.id));
    const assessment = assessConfidence({
      reports,
      sources: demoSources,
      officialSourceIds: [reports[0].sourceId],
      structuredEvidenceReportIds: [reports[0].id],
      calculatedAt: "2099-06-01T12:00:00.000Z",
    });

    expect(assessment.score).toBeLessThanOrEqual(99);
    expect(assessment.positiveFactors.length).toBeGreaterThan(0);
    expect(assessment.positiveFactors.every((factor) => factor.reportIds.length > 0)).toBe(true);
    expect(assessment.explanation).toContain("not a mathematical probability");
  });

  it("penalizes a major contradiction without erasing the evidence trail", () => {
    const reports = demoReports.slice(0, 3).map((report) => ({ ...report, duplicateOfReportId: undefined }));
    const baseline = assessConfidence({ reports, sources: demoSources });
    const disputed = assessConfidence({
      reports,
      sources: demoSources,
      majorContradictionReportIds: [reports[2].id],
    });

    expect(disputed.score).toBeLessThan(baseline.score);
    expect(disputed.negativeFactors.some((factor) => factor.code === "major-contradiction")).toBe(true);
  });

  it("caps unreviewed public information at its audited report confidence", () => {
    const reports = demoReports.slice(0, 3).map((report) => ({
      ...report,
      dataClassification: "public-information" as const,
      confidence: 25,
      verificationState: "needs-review" as const,
    }));
    const assessment = assessConfidence({
      reports,
      sources: demoSources,
      officialSourceIds: reports.map((report) => report.sourceId),
      structuredEvidenceReportIds: reports.map((report) => report.id),
    });

    expect(assessment.score).toBe(25);
    expect(assessment.label).toBe("low");
    expect(assessment.negativeFactors.some((factor) => factor.code === "public-review-ceiling")).toBe(true);
  });
});

describe("deterministic Aether provider", () => {
  it("only cites reports and sources that exist in the provider", async () => {
    const provider = new DeterministicAetherProvider(
      new MockIntelligenceDataProvider(),
      () => new Date("2099-06-01T12:00:00.000Z"),
    );
    const event = demoEvents.find((candidate) => candidate.disputedClaims.length > 0) ?? demoEvents[0];
    const response = await provider.respond("Explain the contradictory reporting", [event.id]);

    expect(response.mode).toBe("contradiction-analysis");
    expect(response.answer).toContain(AETHER_DEMO_DISCLOSURE);
    expect(response.citations.length).toBeGreaterThan(0);
    expect(
      response.citations.every(
        (citation) =>
          demoReports.some((report) => report.id === citation.reportId) &&
          demoSources.some((source) => source.id === citation.sourceId),
      ),
    ).toBe(true);
  });
});

describe("duplicate detection and event correlation", () => {
  it("detects a canonical URL match despite tracking parameters", () => {
    const existing = demoReports[0];
    const url = new URL(existing.url);
    url.searchParams.set("utm_source", "syndication-test");
    const incoming: SourceReport = {
      ...existing,
      id: "report-test-canonical-url",
      externalId: undefined,
      contentHash: "different-content-hash",
      normalizedUrl: undefined,
      url: url.toString(),
    };

    const result = detectDuplicateReport(incoming, [existing], { sources: demoSources });
    expect(result.isDuplicate).toBe(true);
    expect(result.duplicateOfReportId).toBe(existing.id);
    expect(result.candidates[0].reasons.some((reason) => reason.code === "normalized-url")).toBe(true);
  });

  it("explains geographic, category, and time correlation signals", () => {
    const event = demoEvents[0];
    const report: SourceReport = {
      ...demoReports[0],
      id: "report-test-correlation",
      eventId: undefined,
      title: event.title,
      category: event.category,
      countryCode: event.countryCode,
      latitude: event.latitude,
      longitude: event.longitude,
      publishedAt: event.lastUpdatedAt,
    };
    const result = scoreEventCorrelation(report, event);

    expect(result.decision).toBe("associate");
    expect(result.signals.some((signal) => signal.code === "nearby-location")).toBe(true);
    expect(result.signals.some((signal) => signal.code === "same-category")).toBe(true);
    expect(result.signals.some((signal) => signal.code === "time-proximity")).toBe(true);
  });
});

describe("modular report processing", () => {
  it("halts exact duplicates while retaining a stage-by-stage audit", async () => {
    const existing = demoReports[0];
    const incoming: SourceReport = {
      ...existing,
      id: "report-test-pipeline-duplicate",
      processingStatus: "pending",
    };
    const source = demoSources.find((candidate) => candidate.id === incoming.sourceId) ?? demoSources[0];
    const result = await new ReportProcessingPipeline().run(incoming, {
      source,
      existingReports: [existing],
      existingEvents: demoEvents,
      allSources: demoSources,
      now: "2099-06-01T12:00:00.000Z",
    });

    expect(result.outcome).toBe("duplicate");
    expect(result.report.processingStatus).toBe("duplicate");
    expect(result.audit.find((entry) => entry.stageId === "detect-duplicate")?.status).toBe("completed");
    expect(result.audit.find((entry) => entry.stageId === "extract-entities")?.status).toBe("skipped");
  });
});

describe("safe collector adapters", () => {
  it("defaults to a network-free, visibly fictional dry run", async () => {
    const source = demoSources[0];
    const collector = new RssAtomCollector();
    const reports = await collector.collect({
      source,
      requestedAt: "2099-06-01T12:00:00.000Z",
      requestId: "dry-run-test",
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].title).toContain("[FICTIONAL DEMO]");
    expect(reports[0].description).toContain(DEMONSTRATION_DATA_LABEL);
    expect(reports[0].url).toContain("demo.invalid");
  });

  it("parses a public RSS response only through an injected transport", async () => {
    const source = demoSources.find((candidate) => candidate.type === "rss") ?? demoSources[0];
    const collector = new RssAtomCollector({
      mode: "live",
      transport: {
        async request(request) {
          return {
            status: 200,
            finalUrl: request.url,
            headers: { "content-type": "application/rss+xml" },
            resolvedAddress: "93.184.216.34",
            body: `<?xml version="1.0"?><rss><channel><item>
              <guid>fixture-1</guid><title>Structured test bulletin</title>
              <link>https://example.com/public-bulletin</link>
              <description>Public fixture content for collector parsing.</description>
              <pubDate>Tue, 01 Jun 2099 12:00:00 GMT</pubDate>
            </item></channel></rss>`,
          };
        },
      },
    });
    const reports = await collector.collect({
      source,
      requestedAt: "2099-06-01T12:00:00.000Z",
      requestId: "rss-parse-test",
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ externalId: "fixture-1", title: "Structured test bulletin" });
  });

  it("normalizes Guardian metadata without collecting article bodies", async () => {
    const collector = new GuardianOpenPlatformCollector({
      mode: "live",
      endpoint: "https://content.guardianapis.com/search?q=world",
      transport: {
        async request(request) {
          return {
            status: 200,
            finalUrl: request.url,
            headers: { "content-type": "application/json" },
            resolvedAddress: "93.184.216.34",
            body: JSON.stringify({ response: { results: [{
              id: "world/2099/jun/01/example",
              webTitle: "Structured Guardian fixture",
              webUrl: "https://www.theguardian.com/world/2099/jun/01/example",
              webPublicationDate: "2099-06-01T12:00:00Z",
              sectionName: "World news",
              fields: { trailText: "<p>Bounded metadata excerpt.</p>", byline: "Fixture Reporter" },
            }] } }),
          };
        },
      },
    });
    const reports = await collector.collect({
      source: demoSources[0],
      requestedAt: "2099-06-01T12:00:00.000Z",
      requestId: "guardian-parse-test",
    });
    expect(reports[0]).toMatchObject({
      externalId: "world/2099/jun/01/example",
      description: "Bounded metadata excerpt.",
      author: "Fixture Reporter",
    });
    expect(reports[0].bodyText).toBeUndefined();
  });

  it("labels X results as attributable public Post links", async () => {
    const collector = new XRecentSearchCollector({
      mode: "live",
      transport: {
        async request(request) {
          return {
            status: 200,
            finalUrl: request.url,
            headers: { "content-type": "application/json" },
            resolvedAddress: "93.184.216.34",
            body: JSON.stringify({
              data: [{ id: "1234567890", text: "Public fixture signal", author_id: "42", created_at: "2099-06-01T12:00:00Z", lang: "en" }],
              includes: { users: [{ id: "42", username: "fixture_source" }] },
            }),
          };
        },
      },
    });
    const reports = await collector.collect({
      source: demoSources[0],
      requestedAt: "2099-06-01T12:00:00.000Z",
      requestId: "x-parse-test",
    });
    expect(reports[0]).toMatchObject({
      externalId: "1234567890",
      author: "@fixture_source",
      url: "https://x.com/fixture_source/status/1234567890",
    });
  });

  it("rejects local and private collector destinations", () => {
    expect(() => assertPublicHttpsUrl("https://localhost/feed.xml")).toThrow(/forbidden/i);
    expect(() => assertPublicHttpsUrl("https://127.0.0.1/feed.xml")).toThrow(/forbidden/i);
    expect(() => assertPublicHttpsUrl("http://example.com/feed.xml")).toThrow(/HTTPS/i);
    expect(() => assertPublicHttpsUrl("https://[::ffff:ac10:1]/feed.xml")).toThrow(/forbidden/i);
    expect(() => assertPublicHttpsUrl("https://[::ffff:127.0.0.1]/feed.xml")).toThrow(/forbidden/i);
  });

  it("returns queue-ready retries without creating an in-process timer", async () => {
    const source = demoSources[0];
    const failingCollector = new RssAtomCollector({ mode: "live" });
    const job = createCollectorJob(
      failingCollector,
      source,
      "2099-06-01T12:00:00.000Z",
      { maximumAttempts: 3 },
    );
    const times = [new Date("2099-06-01T12:00:00.000Z"), new Date("2099-06-01T12:00:00.010Z")];
    const result = await executeCollectorJob(failingCollector, source, job, {
      now: () => times.shift() ?? new Date("2099-06-01T12:00:00.010Z"),
    });

    expect(result.run.status).toBe("failed");
    expect(result.retryJob?.attempt).toBe(2);
    expect(exponentialBackoffMs(1)).toBe(5_000);
    expect(exponentialBackoffMs(2)).toBe(10_000);
  });

  it("exposes queue scheduling, rate-limit, and idempotency primitives", () => {
    const source = { ...demoSources[0], rateLimitPerMinute: 2 };
    expect(nextScheduledCollectionAt(source, "2099-06-01T12:00:00.000Z")).toBe(
      new Date(Date.parse("2099-06-01T12:00:00.000Z") + source.schedule.intervalMinutes * 60_000).toISOString(),
    );
    expect(
      earliestRateLimitedRunAt(
        source,
        "2099-06-01T12:00:00.000Z",
        "2099-06-01T12:00:10.000Z",
      ),
    ).toBe("2099-06-01T12:00:30.000Z");
    const report = {
      externalId: "PUBLIC-RECORD-42",
      url: "https://example.com/record/42",
      title: "Structured record",
      publishedAt: "2099-06-01T12:00:00.000Z",
      rawPayload: {},
    };
    expect(collectedReportIdempotencyKey(source.id, report)).toBe(
      collectedReportIdempotencyKey(source.id, { ...report, url: "https://mirror.example/42" }),
    );
  });
});
