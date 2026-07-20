import { describe, expect, it } from "vitest";
import {
  D1IntelligenceDataProvider,
  READ_MODEL_COLLECTIONS,
  readModelById,
  seedDemonstrationReadModels,
} from "@/packages/database/d1-read-model-provider";
import {
  enforceReadModelRetention,
  recordDurableEventReview,
  recordDurableRelationshipReview,
  saveDurableMonitoringLayout,
} from "@/packages/database/durable-operations";
import { DEFAULT_DATASET } from "@/packages/database/provider";
import type {
  IntelligenceEvent,
  IntelligenceRelationship,
  MonitoringLayout,
} from "@/packages/shared/types";
import { FakeD1Database } from "./helpers/fake-d1";

describe("D1-backed ARGUS operations", () => {
  it("falls back to fixtures until D1 is seeded, then reads complete D1 documents", async () => {
    const database = new FakeD1Database();
    const provider = new D1IntelligenceDataProvider(database);
    expect(await provider.getEvents()).toHaveLength(DEFAULT_DATASET.events.length);

    const seeded = await seedDemonstrationReadModels(database);
    expect(seeded.collections).toBe(16);
    expect(seeded.records).toBeGreaterThan(100);
    const relationships = await provider.getRelationships();
    expect(relationships).toEqual(DEFAULT_DATASET.relationships.map((relationship) => ({ ...relationship, recordVersion: 1 })));
    expect(relationships.every((relationship) => relationship.recordVersion === 1)).toBe(true);
    expect(await provider.getEventBySlug(DEFAULT_DATASET.events[0].slug)).toMatchObject({ ...DEFAULT_DATASET.events[0], recordVersion: 1 });
  });

  it("persists event decisions, history, and audit records in one D1 batch", async () => {
    const database = new FakeD1Database();
    await seedDemonstrationReadModels(database);
    const event = DEFAULT_DATASET.events.find((item) => item.verificationState !== "analyst-confirmed")!;

    const result = await recordDurableEventReview(database, {
      action: "confirm",
      eventId: event.id,
      reviewerName: "Test Analyst",
      reason: "Independent evidence reviewed.",
    }, "request-event-review");

    expect(result.event.verificationState).toBe("analyst-confirmed");
    expect(database.auditRows).toHaveLength(1);
    expect(await readModelById<IntelligenceEvent>(database, READ_MODEL_COLLECTIONS.events, event.id)).toMatchObject({ reviewerName: "Test Analyst", reviewRequired: false });
    expect(database.readModels.has(`${READ_MODEL_COLLECTIONS.stateHistory}:${result.stateChange.id}`)).toBe(true);
  });

  it("rejects a stale event revision without adding a second audit record", async () => {
    const database = new FakeD1Database();
    await seedDemonstrationReadModels(database);
    const event = await readModelById<IntelligenceEvent>(database, READ_MODEL_COLLECTIONS.events, DEFAULT_DATASET.events[0].id);
    expect(event?.recordVersion).toBe(1);

    await recordDurableEventReview(database, {
      action: "confirm",
      eventId: event!.id,
      reviewerName: "First Reviewer",
      expectedVersion: 1,
    }, "request-first-review");

    await expect(recordDurableEventReview(database, {
      action: "dispute",
      eventId: event!.id,
      reviewerName: "Stale Reviewer",
      reason: "This browser held the older revision.",
      expectedVersion: 1,
    }, "request-stale-review")).rejects.toMatchObject({ status: 409, code: "stale_version" });
    expect(database.auditRows).toHaveLength(1);
  });

  it("persists relationship review history without erasing evidence", async () => {
    const database = new FakeD1Database();
    await seedDemonstrationReadModels(database);
    const relationship = DEFAULT_DATASET.relationships.find((item) => item.analystState === "needs-review")!;

    const result = await recordDurableRelationshipReview(database, relationship.id, {
      analystState: "confirmed",
      reviewerName: "Graph Analyst",
      reason: "Supporting reports independently corroborate the link.",
      relationshipConfidence: 84,
    }, "request-relationship-review");

    expect(result.relationship.analystState).toBe("confirmed");
    expect(result.relationship.relationshipConfidence).toBe(84);
    expect(result.relationship.supportingReportIds).toEqual(relationship.supportingReportIds);
    expect(await readModelById<IntelligenceRelationship>(database, READ_MODEL_COLLECTIONS.relationships, relationship.id)).toMatchObject({ analystState: "confirmed" });
  });

  it("saves reusable monitoring layouts and enforces bounded retention scopes", async () => {
    const database = new FakeD1Database();
    await seedDemonstrationReadModels(database);
    const original = DEFAULT_DATASET.monitoringLayouts[0];
    const layout: MonitoringLayout = { ...original, name: "Durable wall" };

    await saveDurableMonitoringLayout(database, layout, "Layout Analyst", "request-layout");
    expect(await readModelById<MonitoringLayout>(database, READ_MODEL_COLLECTIONS.monitoringLayouts, layout.id)).toMatchObject({ name: "Durable wall" });

    await enforceReadModelRetention(database, "9999-01-01T00:00:00.000Z", [READ_MODEL_COLLECTIONS.alerts]);
    expect([...database.readModels.values()].filter((row) => row.collection === READ_MODEL_COLLECTIONS.alerts)).toHaveLength(0);
    expect([...database.readModels.values()].filter((row) => row.collection === READ_MODEL_COLLECTIONS.events).length).toBeGreaterThan(0);
  });
});
