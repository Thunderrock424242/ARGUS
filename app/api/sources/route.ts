import { intelligenceDataProvider } from "@/packages/database/provider";
import { DEMONSTRATION_DATA_LABEL, normalizedSearchText, paginate } from "@/lib/api/read-models";
import { sourcesQuerySchema } from "@/lib/api/schemas";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateSearchParams } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const query = validateSearchParams(new URL(request.url).searchParams, sourcesQuerySchema);
  if (!query.success) {
    return jsonError(query.status, query.code, query.message, {
      details: query.details,
      requestId,
    });
  }

  try {
    const search = query.data.q?.toLocaleLowerCase("en-US");
    const sources = (await intelligenceDataProvider.getSources())
      .filter((source) => !query.data.type || source.type === query.data.type)
      .filter((source) => !query.data.status || source.status === query.data.status)
      .filter(
        (source) => query.data.enabled === undefined || source.enabled === query.data.enabled,
      )
      .filter(
        (source) => !query.data.category || source.categories.includes(query.data.category),
      )
      .filter(
        (source) =>
          !search ||
          normalizedSearchText(
            source.name,
            source.organization,
            source.region,
            source.categories,
            source.limitations,
            source.independenceGroup,
          ).includes(search),
      )
      .sort((left, right) => left.name.localeCompare(right.name));

    const page = paginate(sources, query.data.page, query.data.limit);
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
    return jsonError(503, "data_unavailable", "Source data is temporarily unavailable.", {
      requestId,
    });
  }
}
