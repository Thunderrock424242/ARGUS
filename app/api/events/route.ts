import { intelligenceDataProvider } from "@/packages/database/provider";
import { normalizedSearchText, paginate, DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { eventsQuerySchema } from "@/lib/api/schemas";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateSearchParams } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const query = validateSearchParams(new URL(request.url).searchParams, eventsQuerySchema);
  if (!query.success) {
    return jsonError(query.status, query.code, query.message, {
      details: query.details,
      requestId,
    });
  }

  try {
    const search = query.data.q?.toLocaleLowerCase("en-US");
    const events = (await intelligenceDataProvider.getEvents())
      .filter((event) => !query.data.category || event.category === query.data.category)
      .filter((event) => !query.data.status || event.status === query.data.status)
      .filter(
        (event) =>
          !query.data.verificationState ||
          event.verificationState === query.data.verificationState,
      )
      .filter((event) => !query.data.severity || event.severity === query.data.severity)
      .filter(
        (event) =>
          query.data.minConfidence === undefined ||
          event.automatedConfidence >= query.data.minConfidence,
      )
      .filter(
        (event) =>
          !query.data.region ||
          event.region?.toLocaleLowerCase("en-US") === query.data.region.toLocaleLowerCase("en-US"),
      )
      .filter(
        (event) => query.data.priority === undefined || event.priority === query.data.priority,
      )
      .filter(
        (event) =>
          !search ||
          normalizedSearchText(
            event.title,
            event.summary,
            event.tags,
            event.region,
            event.countryName,
            event.locationName,
            event.analystNotes,
          ).includes(search),
      );

    events.sort((left, right) => {
      if (query.data.sort === "severity") return right.severity - left.severity;
      if (query.data.sort === "confidence") {
        return right.automatedConfidence - left.automatedConfidence;
      }
      return Date.parse(right.lastUpdatedAt) - Date.parse(left.lastUpdatedAt);
    });

    const page = paginate(events, query.data.page, query.data.limit);
    return jsonData(page.items, {
      meta: {
        page: query.data.page,
        limit: query.data.limit,
        total: page.total,
        totalPages: page.totalPages,
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
