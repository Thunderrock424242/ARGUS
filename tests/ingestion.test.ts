import { describe, expect, it } from "vitest";
import { GET as listIngestion, POST as submitIngestion } from "@/app/api/admin/ingestion/route";
import { POST as reviewIngestion } from "@/app/api/admin/ingestion/[id]/route";
import { POST as adjustIngestionConfidence } from "@/app/api/admin/ingestion/[id]/confidence/route";
import { demoSources } from "@/packages/shared/demo-data";
import { FakeD1Database } from "./helpers/fake-d1";

const adminToken = "ingestion-test-admin-token-with-sufficient-entropy";

function intake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceId: demoSources.find((source) => source.enabled)?.id ?? demoSources[0].id,
    url: "https://example.org/argus/intelligence-report-001?utm_source=test",
    title: "Demonstration infrastructure interruption report",
    description: "A fictional public bulletin describing a short infrastructure interruption.",
    publishedAt: "2042-03-10T14:30:00.000Z",
    provenanceNotes: "Submitted from an attributed public demonstration bulletin.",
    ...overrides,
  };
}

function request(path: string, body?: Record<string, unknown>, method = "POST"): Request {
  return new Request(`https://argus.example${path}`, {
    method,
    headers: {
      authorization: `Bearer ${adminToken}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function payload<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

describe("durable ingestion pipeline", () => {
  it("normalizes, hashes, audits, and idempotently queues a submission", async () => {
    const database = new FakeD1Database();
    const context = { database, adminToken };
    const first = await submitIngestion(request("/api/admin/ingestion", intake()), context);
    expect(first.status).toBe(201);
    const firstPayload = await payload<{
      data: { id: string; status: string; normalizedUrl: string; contentHash: string; confidence: number; recordVersion: number };
      meta: { idempotent: boolean };
    }>(first);
    expect(firstPayload.data).toMatchObject({ status: "needs-review", confidence: 25, recordVersion: 1 });
    expect(firstPayload.data.normalizedUrl).not.toContain("utm_source");
    expect(firstPayload.data.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(firstPayload.meta.idempotent).toBe(false);
    expect(database.ingestionAttempts).toHaveLength(1);
    expect(database.auditRows).toHaveLength(1);
    expect(database.readModels.has(`reports:report-${firstPayload.data.id}`)).toBe(true);
    expect(JSON.parse(database.readModels.get(`reports:report-${firstPayload.data.id}`)!.document)).toMatchObject({
      confidence: 25,
      verificationState: "needs-review",
      processingStatus: "pending",
      dataClassification: "public-information",
    });

    const repeated = await submitIngestion(request("/api/admin/ingestion", intake()), context);
    expect(repeated.status).toBe(200);
    const repeatedPayload = await payload<{ data: { id: string }; meta: { idempotent: boolean } }>(repeated);
    expect(repeatedPayload.data.id).toBe(firstPayload.data.id);
    expect(repeatedPayload.meta.idempotent).toBe(true);
    expect(database.ingestionAttempts).toHaveLength(1);
    expect(database.auditRows).toHaveLength(1);

    const listed = await listIngestion(request("/api/admin/ingestion?page=1&limit=25", undefined, "GET"), context);
    const listedPayload = await payload<{ data: unknown[]; meta: { total: number } }>(listed);
    expect(listed.status).toBe(200);
    expect(listedPayload.data).toHaveLength(1);
    expect(listedPayload.meta.total).toBe(1);
  });

  it("returns the original source external ID even if a client changes its replay key", async () => {
    const database = new FakeD1Database();
    const context = { database, adminToken };
    const first = await submitIngestion(
      request("/api/admin/ingestion", intake({ externalId: "bulletin-2042-001", idempotencyKey: "client-key-first-001" })),
      context,
    );
    const firstData = (await payload<{ data: { id: string } }>(first)).data;
    const replay = await submitIngestion(
      request("/api/admin/ingestion", intake({ externalId: "bulletin-2042-001", idempotencyKey: "client-key-second-002" })),
      context,
    );
    const replayPayload = await payload<{ data: { id: string }; meta: { idempotent: boolean } }>(replay);
    expect(replay.status).toBe(200);
    expect(replayPayload.data.id).toBe(firstData.id);
    expect(replayPayload.meta.idempotent).toBe(true);
    expect(database.ingestionSubmissions.size).toBe(1);
  });

  it("uses versioned review to promote a low-confidence public report", async () => {
    const database = new FakeD1Database();
    const context = { database, adminToken };
    const submitted = await submitIngestion(request("/api/admin/ingestion", intake()), context);
    const submission = (await payload<{ data: { id: string; recordVersion: number } }>(submitted)).data;

    const approved = await reviewIngestion(
      request(`/api/admin/ingestion/${submission.id}`, {
        decision: "approve",
        reason: "The source attribution and normalized evidence were verified.",
        expectedVersion: submission.recordVersion,
      }),
      { ...context, params: Promise.resolve({ id: submission.id }) },
    );
    expect(approved.status).toBe(200);
    const approvedPayload = await payload<{
      data: { submission: { status: string; confidence: number; recordVersion: number }; report: { id: string; confidence: number; verificationState: string; processingStatus: string } };
      meta: { canonicalReportCreated: boolean };
    }>(approved);
    expect(approvedPayload.data.submission).toMatchObject({ status: "approved", confidence: 60, recordVersion: 2 });
    expect(approvedPayload.data.report).toMatchObject({ confidence: 60, verificationState: "analyst-confirmed", processingStatus: "processed" });
    expect(approvedPayload.meta.canonicalReportCreated).toBe(true);
    expect(database.readModels.has(`reports:${approvedPayload.data.report.id}`)).toBe(true);
    expect(database.auditRows).toHaveLength(2);

    const stale = await reviewIngestion(
      request(`/api/admin/ingestion/${submission.id}`, {
        decision: "reject",
        reason: "This decision was based on an outdated screen.",
        expectedVersion: submission.recordVersion,
      }),
      { ...context, params: Promise.resolve({ id: submission.id }) },
    );
    expect(stale.status).toBe(409);
    expect((await payload<{ error: { code: string } }>(stale)).error.code).toBe("stale_version");
    expect(database.auditRows).toHaveLength(2);
  });

  it("allows only the administrator confidence endpoint to raise a pending public report", async () => {
    const database = new FakeD1Database();
    const context = { database, adminToken };
    const submitted = await submitIngestion(request("/api/admin/ingestion", intake()), context);
    const submission = (await payload<{ data: { id: string; recordVersion: number } }>(submitted)).data;

    const adjusted = await adjustIngestionConfidence(
      request(`/api/admin/ingestion/${submission.id}/confidence`, {
        confidence: 45,
        reason: "Administrator verified the official bulletin identifier while full review remains pending.",
        expectedVersion: submission.recordVersion,
      }),
      { ...context, params: Promise.resolve({ id: submission.id }) },
    );
    expect(adjusted.status).toBe(200);
    const adjustedPayload = await payload<{
      data: { submission: { confidence: number; status: string; recordVersion: number }; report: { confidence: number; verificationState: string } };
    }>(adjusted);
    expect(adjustedPayload.data.submission).toMatchObject({ confidence: 45, status: "needs-review", recordVersion: 2 });
    expect(adjustedPayload.data.report).toMatchObject({ confidence: 45, verificationState: "needs-review" });
    expect(database.auditRows.at(-1)?.[5]).toBe("ingestion-confidence-updated");
  });

  it("quarantines canonical duplicates and rejects unsafe evidence URLs", async () => {
    const database = new FakeD1Database();
    const context = { database, adminToken };
    const submitted = await submitIngestion(request("/api/admin/ingestion", intake()), context);
    const submission = (await payload<{ data: { id: string; recordVersion: number } }>(submitted)).data;
    await reviewIngestion(
      request(`/api/admin/ingestion/${submission.id}`, {
        decision: "approve",
        reason: "Verified for duplicate detection regression coverage.",
        expectedVersion: submission.recordVersion,
      }),
      { ...context, params: Promise.resolve({ id: submission.id }) },
    );

    const duplicate = await submitIngestion(
      request("/api/admin/ingestion", intake({ idempotencyKey: "second-client-attempt-001" })),
      context,
    );
    expect(duplicate.status).toBe(201);
    const duplicateData = (await payload<{ data: { status: string; duplicateOfReportId?: string } }>(duplicate)).data;
    expect(duplicateData.status).toBe("duplicate");
    expect(duplicateData.duplicateOfReportId).toBe(`report-${submission.id}`);

    const unsafe = await submitIngestion(
      request("/api/admin/ingestion", intake({ url: "https://127.0.0.1/private" })),
      context,
    );
    expect(unsafe.status).toBe(422);
    expect((await payload<{ error: { code: string } }>(unsafe)).error.code).toBe("unsafe_source_url");
  });
});
