import { intelligenceDataProvider } from "@/packages/database/provider";
import {
  DEMONSTRATION_DATA_LABEL,
  normalizedSearchText,
  paginate,
  parseTimestamp,
  publicReportView,
} from "@/lib/api/read-models";
import { reportsQuerySchema } from "@/lib/api/schemas";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateSearchParams } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const query = validateSearchParams(new URL(request.url).searchParams, reportsQuerySchema);
  if (!query.success) {
    return jsonError(query.status, query.code, query.message, {
      details: query.details,
      requestId,
    });
  }

  try {
    const search = query.data.q?.toLocaleLowerCase("en-US");
    const dateFrom = parseTimestamp(query.data.dateFrom);
    const dateTo = parseTimestamp(query.data.dateTo);
    const reports = (await intelligenceDataProvider.getReports())
      .filter((report) => !query.data.status || report.processingStatus === query.data.status)
      .filter((report) => !query.data.sourceId || report.sourceId === query.data.sourceId)
      .filter((report) => !query.data.eventId || report.eventId === query.data.eventId)
      .filter((report) => !query.data.countryCode || report.countryCode === query.data.countryCode)
      .filter((report) => dateFrom === null || Date.parse(report.publishedAt) >= dateFrom)
      .filter((report) => dateTo === null || Date.parse(report.publishedAt) <= dateTo)
      .filter(
        (report) =>
          !search ||
          normalizedSearchText(
            report.title,
            report.description,
            report.bodyText,
            report.author,
            report.countryCode,
          ).includes(search),
      )
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

    const page = paginate(reports, query.data.page, query.data.limit);
    return jsonData(page.items.map(publicReportView), {
      meta: {
        page: query.data.page,
        limit: query.data.limit,
        total: page.total,
        totalPages: page.totalPages,
        requestId,
        rawPayloadsIncluded: false,
        dataClassification: "demonstration",
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      },
    });
  } catch {
    return jsonError(503, "data_unavailable", "Report data is temporarily unavailable.", {
      requestId,
    });
  }
}
