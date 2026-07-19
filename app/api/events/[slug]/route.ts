import { intelligenceDataProvider } from "@/packages/database/provider";
import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { routeIdentifierSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

interface EventRouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: EventRouteContext): Promise<Response> {
  const requestId = requestIdFrom(request);
  const parsedSlug = routeIdentifierSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) {
    return jsonError(422, "invalid_event_slug", "The event slug is invalid.", { requestId });
  }

  try {
    const event = await intelligenceDataProvider.getEventBySlug(parsedSlug.data);
    if (!event) {
      return jsonError(404, "event_not_found", "No event exists with that slug.", { requestId });
    }
    return jsonData(event, {
      meta: {
        requestId,
        dataClassification: "demonstration",
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      },
    });
  } catch {
    return jsonError(503, "data_unavailable", "Event data is temporarily unavailable.", {
      requestId,
    });
  }
}
