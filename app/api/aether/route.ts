import { z } from "zod";
import { aetherProvider } from "@/packages/intelligence/aether";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateJsonBody } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const aetherRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(4_000),
    contextEventIds: z
      .array(z.string().trim().min(1).max(160))
      .max(8)
      .default([]),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const body = await validateJsonBody(request, aetherRequestSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
    });
  }

  try {
    const response = await aetherProvider.respond(
      body.data.prompt,
      body.data.contextEventIds,
    );
    return jsonData(response, { meta: { requestId } });
  } catch {
    return jsonError(
      503,
      "aether_unavailable",
      "Aether could not produce an evidence-bound response.",
      { requestId },
    );
  }
}
