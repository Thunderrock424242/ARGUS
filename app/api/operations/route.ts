import { intelligenceDataProvider } from "@/packages/database/provider";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const [events, reports, relationships, markets, alerts, cameras, stateHistory] = await Promise.all([
      intelligenceDataProvider.getEvents(),
      intelligenceDataProvider.getReports(),
      intelligenceDataProvider.getRelationships(),
      intelligenceDataProvider.getMarketImpacts(),
      intelligenceDataProvider.getAlerts(),
      intelligenceDataProvider.getCameraSources(),
      intelligenceDataProvider.getStateHistory(),
    ]);
    return jsonData({
      generatedAt: new Date().toISOString(),
      counts: {
        events: events.length,
        reports: reports.length,
        relationships: relationships.length,
        consequencesAwaitingReview: relationships.filter((item) => item.analystState === "needs-review").length,
        marketAnomalies: markets.filter((item) => item.marketAnomalyScore >= 70).length,
        activeAlerts: alerts.filter((item) => item.state === "active" || item.state === "queued").length,
        cameraSources: cameras.length,
        historicalChanges: stateHistory.length,
      },
      latestAlerts: alerts.slice(0, 10),
    }, { meta: { requestId, dataClassification: "demonstration" } });
  } catch {
    return jsonError(503, "data_unavailable", "Operations summary is temporarily unavailable.", { requestId });
  }
}
