import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { intelligenceDataProvider } from "@/packages/database/provider";
import { demoMetrics } from "@/packages/shared/demo-data";
import type { PlatformMetrics } from "@/packages/shared/types";

export async function GET(request: Request, context: { demoDataEnabled?: boolean } = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const [events, reports, sources, relationships, graphNodes, relationshipHistory, marketAssets, marketImpacts, stateHistory, alerts] = await Promise.all([
      intelligenceDataProvider.getEvents(),
      intelligenceDataProvider.getReports(),
      intelligenceDataProvider.getSources(),
      intelligenceDataProvider.getRelationships(),
      intelligenceDataProvider.getGraphNodes(),
      intelligenceDataProvider.getRelationshipHistory(),
      intelligenceDataProvider.getMarketAssets(),
      intelligenceDataProvider.getMarketImpacts(),
      intelligenceDataProvider.getStateHistory(),
      intelligenceDataProvider.getAlerts(),
    ]);
    const metrics: PlatformMetrics = {
      ...demoMetrics,
      generatedAt: new Date().toISOString(),
      activeEvents: events.filter((event) => event.status === "active").length,
      developingEvents: events.filter((event) => event.status === "developing" || event.status === "emerging").length,
      criticalEvents: events.filter((event) => event.severity === 5 && event.status !== "resolved").length,
      reportsCollectedToday: reports.length,
      reportsAwaitingProcessing: reports.filter((report) => report.processingStatus === "pending" || report.processingStatus === "processing").length,
      eventsAwaitingReview: events.filter((event) => event.reviewRequired).length,
      contradictoryClaims: events.reduce((total, event) => total + event.contradictionCount, 0),
      sourcesOnline: sources.filter((source) => source.status === "online").length,
      sourcesTotal: sources.length,
      failedSources: sources.filter((source) => source.status === "offline").length,
      lastSuccessfulIngestionAt: reports.reduce((latest, report) => report.collectedAt > latest ? report.collectedAt : latest, demoMetrics.lastSuccessfulIngestionAt),
      databaseStatus: "operational",
    };
    const safeReports = reports.map((report) => ({
      ...report,
      rawPayload: { redacted: true },
    }));
    const hasDemonstrationData = [events, reports, sources, relationships, graphNodes, marketAssets, marketImpacts, alerts]
      .some((records) => records.some((record) => record.dataClassification === "demonstration"));
    return jsonData({ events, reports: safeReports, sources, relationships, graphNodes, relationshipHistory, marketAssets, marketImpacts, stateHistory, alerts, metrics }, { meta: { requestId, dataClassification: hasDemonstrationData ? "demonstration" : "public-information", demoDataEnabled: context.demoDataEnabled ?? true, source: "runtime-provider" } });
  } catch {
    return jsonError(503, "operations_snapshot_unavailable", "The operations snapshot is temporarily unavailable.", { requestId });
  }
}
