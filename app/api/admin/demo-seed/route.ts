import { actorForRequest, requirePermission } from "@/lib/api/admin-guard";
import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { demoSeedRequestSchema } from "@/lib/api/schemas";
import { validateJsonBody } from "@/lib/api/validation";
import { seedDurableDemonstrationData } from "@/packages/database/durable-operations";
import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";

interface SeedRouteContext {
  adminToken?: string;
  database?: D1DocumentDatabase;
  demoDataEnabled?: boolean;
}

export async function POST(request: Request, context: SeedRouteContext = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "demo:seed", "demo-seed", requestId, context);
  if (!guard.authorized) return guard.response;
  if (context.demoDataEnabled === false) {
    return jsonError(409, "demo_disabled", "Demonstration data is disabled for this Worker deployment.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  if (!context.database) {
    return jsonError(503, "durable_store_unavailable", "D1 is required before demonstration data can be seeded.", { requestId, headers: guard.rateLimitHeaders });
  }
  const body = await validateJsonBody(request, demoSeedRequestSchema);
  if (!body.success) return jsonError(body.status, body.code, body.message, { details: body.details, requestId, headers: guard.rateLimitHeaders });
  try {
    const actor = actorForRequest(guard.principal, body.data.reviewerName);
    const result = await seedDurableDemonstrationData(context.database, actor.name, requestId, actor.id);
    return jsonData({ ...result, durability: "d1", dataClassification: "demonstration", demoDataLabel: DEMONSTRATION_DATA_LABEL }, { status: 201, headers: guard.rateLimitHeaders, meta: { requestId } });
  } catch {
    return jsonError(503, "seed_failed", "The D1 demonstration seed could not be completed.", { requestId, headers: guard.rateLimitHeaders });
  }
}
