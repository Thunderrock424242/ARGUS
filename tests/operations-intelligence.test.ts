import { describe, expect, it } from "vitest";
import { AlertManager } from "@/packages/intelligence/alert-manager";
import { buildImpactChains, recalculateRelationship, runImpactRules } from "@/packages/intelligence/impact-engine";
import { calculateMarketAnomaly, createMarketImpactAssessment } from "@/packages/intelligence/market-impact";
import { MockIntelligenceDataProvider } from "@/packages/database/provider";
import { demoEvents, demoReports } from "@/packages/shared/demo-data";
import { demoAlerts, demoGraphNodes, demoImpactRules, demoRelationships } from "@/packages/shared/operations-demo-data";

describe("ARGUS relationship fixtures", () => {
  it("keeps every graph edge and evidence reference resolvable", () => {
    const nodeIds = new Set(demoGraphNodes.map((node) => node.id));
    const reportIds = new Set(demoReports.map((report) => report.id));
    for (const relationship of demoRelationships) {
      expect(nodeIds.has(relationship.sourceNodeId), relationship.id).toBe(true);
      expect(nodeIds.has(relationship.targetNodeId), relationship.id).toBe(true);
      expect(relationship.sourceNodeId).not.toBe(relationship.targetNodeId);
      expect(relationship.relationshipConfidence).toBeGreaterThanOrEqual(0);
      expect(relationship.relationshipConfidence).toBeLessThanOrEqual(100);
      for (const reportId of [...relationship.supportingReportIds, ...relationship.contradictingReportIds]) {
        expect(reportIds.has(reportId), `${relationship.id}:${reportId}`).toBe(true);
      }
    }
  });

  it("returns defensive copies through the expanded provider", async () => {
    const provider = new MockIntelligenceDataProvider();
    const relationships = await provider.getRelationships();
    relationships[0].explanation = "mutated";
    expect((await provider.getRelationships())[0].explanation).not.toBe("mutated");
    expect(await provider.getMarketImpacts()).not.toHaveLength(0);
    expect(await provider.getConflictProfiles()).not.toHaveLength(0);
  });
});

describe("deterministic impact rules", () => {
  it("labels every generated consequence for review and caps causal confidence", () => {
    const result = runImpactRules(demoEvents, demoGraphNodes, demoImpactRules, "2042-03-14T14:00:00.000Z");
    expect(result.relationships.length).toBeGreaterThan(0);
    for (const relationship of result.relationships) {
      expect(relationship.analystState).toBe("needs-review");
      expect(relationship.analystNotes).toContain("Hypothesis");
      expect(relationship.causalConfidence ?? 0).toBeLessThanOrEqual(45);
      expect(relationship.supportingReportIds.length).toBeGreaterThan(0);
    }
  });

  it("recalculates one edge without applying its confidence to the chain", () => {
    const initial = demoRelationships.find((relationship) => relationship.id === "rel-quake-port")!;
    const result = recalculateRelationship(initial, { supportingReportIds: [], contradictingReportIds: [demoReports[0].id], occurredAt: "2042-03-14T15:00:00.000Z" });
    expect(result.relationship.relationshipConfidence).toBeLessThan(initial.relationshipConfidence);
    expect(result.history.relationshipId).toBe(initial.id);
    const chains = buildImpactChains(demoRelationships, initial.sourceNodeId, 5);
    expect(chains.some((chain) => chain.relationshipIds.length >= 3)).toBe(true);
    expect(chains[0].minimumRelationshipConfidence).toBe(Math.min(...chains[0].relationshipIds.map((id) => demoRelationships.find((relationship) => relationship.id === id)!.relationshipConfidence)));
  });
});

describe("market anomaly boundaries", () => {
  const observation = {
    eventId: demoEvents[0].id,
    assetId: "asset-test",
    priceBefore: 100,
    priceAfter: 108,
    volume: 2_600,
    averageVolume: 1_000,
    normalVolatilityPercent: 1.5,
    sectorChangePercent: 0.5,
    indexChangePercent: 0.2,
    broaderMarketChangePercent: 0.1,
    exposureConfidence: 90,
    supportingReportIds: [demoReports[0].id],
    calculatedAt: "2042-03-14T15:00:00.000Z",
    demoDataLabel: "Demonstration data — not real-world intelligence",
  };

  it("detects unusual movement while keeping causality conservative", () => {
    const anomaly = calculateMarketAnomaly(observation);
    const assessment = createMarketImpactAssessment(observation);
    expect(anomaly.score).toBeGreaterThanOrEqual(65);
    expect(assessment.explanation).toContain("causation has not been confirmed");
    expect(assessment.causalConfidence).toBeLessThanOrEqual(45);
    expect(assessment.causalConfidence).toBeLessThan(assessment.relationshipConfidence);
  });
});

describe("alert queue policy", () => {
  it("prioritizes critical alerts and suppresses duplicate keys", () => {
    let now = Date.parse("2042-03-14T16:00:00.000Z");
    const manager = new AlertManager({ now: () => now });
    const normal = { ...demoAlerts[1], id: "normal", priority: "normal" as const, deduplicationKey: "normal-key" };
    const critical = { ...demoAlerts[0], id: "critical", priority: "critical" as const, deduplicationKey: "critical-key" };
    expect(manager.enqueue(normal).accepted).toBe(true);
    expect(manager.enqueue(critical).accepted).toBe(true);
    expect(manager.enqueue({ ...critical, id: "duplicate" }).reason).toBe("duplicate");
    expect(manager.next()?.id).toBe("critical");
    manager.acknowledge("critical");
    expect(manager.next()?.id).toBe("normal");
    manager.acknowledge("normal");
    now += normal.cooldownSeconds * 1_000 - 1;
    expect(manager.enqueue({ ...normal, id: "cooldown" }).reason).toBe("cooldown");
  });
});
