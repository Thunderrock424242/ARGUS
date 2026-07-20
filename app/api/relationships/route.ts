import { intelligenceDataProvider } from "@/packages/database/provider";
import { relationshipsQuerySchema } from "@/lib/api/schemas";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateSearchParams } from "@/lib/api/validation";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const query = validateSearchParams(new URL(request.url).searchParams, relationshipsQuerySchema);
  if (!query.success) return jsonError(query.status, query.code, query.message, { details: query.details, requestId });
  try {
    const [relationships, nodes, history] = await Promise.all([
      intelligenceDataProvider.getRelationships(),
      intelligenceDataProvider.getGraphNodes(),
      intelligenceDataProvider.getRelationshipHistory(),
    ]);
    const filtered = relationships
      .filter((item) => item.relationshipConfidence >= query.data.minConfidence)
      .filter((item) => !query.data.analystState || item.analystState === query.data.analystState)
      .filter((item) => !query.data.relationshipType || item.relationshipType === query.data.relationshipType)
      .filter((item) => !query.data.nodeId || item.sourceNodeId === query.data.nodeId || item.targetNodeId === query.data.nodeId)
      .slice(0, query.data.limit);
    const nodeIds = new Set(filtered.flatMap((item) => [item.sourceNodeId, item.targetNodeId]));
    const relationshipIds = new Set(filtered.map((item) => item.id));
    return jsonData({ relationships: filtered, nodes: nodes.filter((node) => nodeIds.has(node.id)), history: history.filter((entry) => relationshipIds.has(entry.relationshipId)) }, { meta: { requestId, total: filtered.length, dataClassification: "demonstration", warning: "Correlation and temporal order do not establish causation." } });
  } catch {
    return jsonError(503, "data_unavailable", "Relationship data is temporarily unavailable.", { requestId });
  }
}
