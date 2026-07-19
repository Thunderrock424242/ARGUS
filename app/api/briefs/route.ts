import { intelligenceDataProvider } from "@/packages/database/provider";
import { DEMONSTRATION_DATA_LABEL, normalizedSearchText, paginate } from "@/lib/api/read-models";
import { briefsQuerySchema } from "@/lib/api/schemas";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateSearchParams } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const query = validateSearchParams(new URL(request.url).searchParams, briefsQuerySchema);
  if (!query.success) {
    return jsonError(query.status, query.code, query.message, {
      details: query.details,
      requestId,
    });
  }

  try {
    const search = query.data.q?.toLocaleLowerCase("en-US");
    const briefs = (await intelligenceDataProvider.getBriefs())
      .filter((brief) => !query.data.type || brief.type === query.data.type)
      .filter((brief) => !query.data.status || brief.status === query.data.status)
      .filter(
        (brief) =>
          !search ||
          normalizedSearchText(
            brief.title,
            brief.executiveSummary,
            brief.aetherAnalysis,
            brief.collectionGaps,
          ).includes(search),
      )
      .sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt));

    const page = paginate(briefs, query.data.page, query.data.limit);
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
    return jsonError(503, "data_unavailable", "Brief data is temporarily unavailable.", {
      requestId,
    });
  }
}
