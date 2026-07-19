import { intelligenceDataProvider } from "@/packages/database/provider";
import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  try {
    const [events, reports, sources, briefs] = await Promise.all([
      intelligenceDataProvider.getEvents(),
      intelligenceDataProvider.getReports(),
      intelligenceDataProvider.getSources(),
      intelligenceDataProvider.getBriefs(),
    ]);
    const latencyMs = Math.max(0, Math.round((performance.now() - startedAt) * 10) / 10);
    return jsonData(
      {
        status: "operational",
        checkedAt: new Date().toISOString(),
        services: {
          api: { status: "operational", latencyMs },
          dataProvider: {
            status: "operational",
            mode: "mock",
            records: {
              events: events.length,
              reports: reports.length,
              sources: sources.length,
              briefs: briefs.length,
            },
          },
          collectors: {
            status: "dry-run",
            networkCollectionEnabledFromApi: false,
          },
        },
        dataClassification: "demonstration",
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      },
      {
        meta: { requestId },
        headers: { "server-timing": `provider;dur=${latencyMs}` },
      },
    );
  } catch {
    return jsonError(503, "health_check_failed", "One or more required services are unavailable.", {
      requestId,
    });
  }
}
