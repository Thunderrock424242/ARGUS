import { intelligenceDataProvider } from "@/packages/database/provider";
import { marketImpactsQuerySchema } from "@/lib/api/schemas";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateSearchParams } from "@/lib/api/validation";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const query = validateSearchParams(new URL(request.url).searchParams, marketImpactsQuerySchema);
  if (!query.success) return jsonError(query.status, query.code, query.message, { details: query.details, requestId });
  try {
    const [assessments, assets] = await Promise.all([intelligenceDataProvider.getMarketImpacts(), intelligenceDataProvider.getMarketAssets()]);
    const filtered = assessments
      .filter((item) => item.marketAnomalyScore >= query.data.minAnomaly)
      .filter((item) => !query.data.analystState || item.analystState === query.data.analystState)
      .filter((item) => !query.data.eventId || item.eventId === query.data.eventId)
      .filter((item) => !query.data.assetId || item.assetId === query.data.assetId);
    const assetIds = new Set(filtered.map((item) => item.assetId));
    return jsonData({ assessments: filtered, assets: assets.filter((asset) => assetIds.has(asset.id)) }, { meta: { requestId, total: filtered.length, dataClassification: "demonstration", warning: "Market timing and exposure do not prove event causation." } });
  } catch {
    return jsonError(503, "data_unavailable", "Market-impact data is temporarily unavailable.", { requestId });
  }
}
