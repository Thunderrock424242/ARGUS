import { intelligenceDataProvider } from "@/packages/database/provider";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const [conflicts, regions] = await Promise.all([intelligenceDataProvider.getConflictProfiles(), intelligenceDataProvider.getRegionalProfiles()]);
    return jsonData({ conflicts, regions }, { meta: { requestId, dataClassification: "demonstration", warning: "Source-specific estimates are not merged into unsupported totals." } });
  } catch {
    return jsonError(503, "data_unavailable", "Conflict-profile data is temporarily unavailable.", { requestId });
  }
}
