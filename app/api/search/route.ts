import { intelligenceDataProvider } from "@/packages/database/provider";
import {
  DEMONSTRATION_DATA_LABEL,
  normalizedSearchText,
  parseTimestamp,
} from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { searchQuerySchema } from "@/lib/api/schemas";
import { validateSearchParams } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

interface SearchResult {
  type: "event" | "report" | "source" | "brief" | "watchlist";
  id: string;
  title: string;
  summary: string;
  href: string;
  score: number;
  occurredAt?: string;
  metadata: Record<string, string | number | boolean | undefined>;
}

function relevance(title: string, text: string, term: string): number {
  const normalizedTitle = normalizedSearchText(title);
  if (normalizedTitle === term) return 100;
  if (normalizedTitle.startsWith(term)) return 80;
  if (normalizedTitle.includes(term)) return 60;
  return text.includes(term) ? 30 : 0;
}

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const query = validateSearchParams(new URL(request.url).searchParams, searchQuerySchema);
  if (!query.success) {
    return jsonError(query.status, query.code, query.message, {
      details: query.details,
      requestId,
    });
  }

  try {
    const term = normalizedSearchText(query.data.q);
    const dateFrom = parseTimestamp(query.data.dateFrom);
    const dateTo = parseTimestamp(query.data.dateTo);
    const [events, reports, sources, briefs, watchlists] = await Promise.all([
      intelligenceDataProvider.getEvents(),
      intelligenceDataProvider.getReports(),
      intelligenceDataProvider.getSources(),
      intelligenceDataProvider.getBriefs(),
      intelligenceDataProvider.getWatchlists(),
    ]);
    const results: SearchResult[] = [];

    if (query.data.type === "all" || query.data.type === "event") {
      for (const event of events) {
        if (query.data.category && event.category !== query.data.category) continue;
        if (query.data.region && event.region?.toLocaleLowerCase("en-US") !== query.data.region.toLocaleLowerCase("en-US")) continue;
        if (query.data.minConfidence !== undefined && event.automatedConfidence < query.data.minConfidence) continue;
        if (query.data.severity && event.severity !== query.data.severity) continue;
        if (query.data.verificationState && event.verificationState !== query.data.verificationState) continue;
        const timestamp = Date.parse(event.lastUpdatedAt);
        if (dateFrom !== null && timestamp < dateFrom) continue;
        if (dateTo !== null && timestamp > dateTo) continue;
        const text = normalizedSearchText(
          event.title,
          event.summary,
          event.tags,
          event.region,
          event.countryName,
          event.locationName,
          event.analystNotes,
        );
        const score = relevance(event.title, text, term);
        if (!score) continue;
        results.push({
          type: "event",
          id: event.id,
          title: event.title,
          summary: event.summary,
          href: `/events/${encodeURIComponent(event.slug)}`,
          score,
          occurredAt: event.lastUpdatedAt,
          metadata: {
            category: event.category,
            severity: event.severity,
            confidence: event.automatedConfidence,
            verificationState: event.verificationState,
            region: event.region,
            locationName: event.locationName,
          },
        });
      }
    }

    if (query.data.type === "all" || query.data.type === "report") {
      for (const report of reports) {
        if (query.data.sourceId && report.sourceId !== query.data.sourceId) continue;
        if (query.data.category && report.category !== query.data.category) continue;
        const timestamp = Date.parse(report.publishedAt);
        if (dateFrom !== null && timestamp < dateFrom) continue;
        if (dateTo !== null && timestamp > dateTo) continue;
        const text = normalizedSearchText(report.title, report.description, report.bodyText, report.author);
        const score = relevance(report.title, text, term);
        if (!score) continue;
        results.push({
          type: "report",
          id: report.id,
          title: report.title,
          summary: report.description ?? "Source report",
          href: report.eventId ? `/events?report=${encodeURIComponent(report.id)}` : "/events",
          score,
          occurredAt: report.publishedAt,
          metadata: {
            sourceId: report.sourceId,
            processingStatus: report.processingStatus,
            countryCode: report.countryCode,
          },
        });
      }
    }

    if (query.data.type === "all" || query.data.type === "source") {
      for (const source of sources) {
        if (query.data.category && !source.categories.includes(query.data.category)) continue;
        if (query.data.sourceId && source.id !== query.data.sourceId) continue;
        const text = normalizedSearchText(
          source.name,
          source.organization,
          source.region,
          source.categories,
          source.limitations,
        );
        const score = relevance(source.name, text, term);
        if (!score) continue;
        results.push({
          type: "source",
          id: source.id,
          title: source.name,
          summary: `${source.organization} · ${source.limitations}`,
          href: "/sources",
          score,
          occurredAt: source.lastCheckedAt,
          metadata: {
            sourceType: source.type,
            status: source.status,
            reliabilityScore: source.reliabilityScore,
            enabled: source.enabled,
          },
        });
      }
    }

    if (query.data.type === "all" || query.data.type === "brief") {
      for (const brief of briefs) {
        const timestamp = Date.parse(brief.generatedAt);
        if (dateFrom !== null && timestamp < dateFrom) continue;
        if (dateTo !== null && timestamp > dateTo) continue;
        const text = normalizedSearchText(
          brief.title,
          brief.executiveSummary,
          brief.aetherAnalysis,
          brief.collectionGaps,
        );
        const score = relevance(brief.title, text, term);
        if (!score) continue;
        results.push({
          type: "brief",
          id: brief.id,
          title: brief.title,
          summary: brief.executiveSummary,
          href: `/briefs/${encodeURIComponent(brief.slug)}`,
          score,
          occurredAt: brief.generatedAt,
          metadata: { briefType: brief.type, status: brief.status, generatedBy: brief.generatedBy },
        });
      }
    }

    if (query.data.type === "all" || query.data.type === "watchlist") {
      for (const watchlist of watchlists) {
        const text = normalizedSearchText(watchlist.name, watchlist.type, watchlist.notes);
        const score = relevance(watchlist.name, text, term);
        if (!score) continue;
        results.push({
          type: "watchlist",
          id: watchlist.id,
          title: watchlist.name,
          summary: watchlist.notes ?? `${watchlist.type} watchlist`,
          href: "/watchlists",
          score,
          occurredAt: watchlist.updatedAt,
          metadata: {
            watchlistType: watchlist.type,
            priority: watchlist.priority,
            enabled: watchlist.enabled,
            matchCount: watchlist.matchCount,
          },
        });
      }
    }

    results.sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return Date.parse(right.occurredAt ?? "1970-01-01") - Date.parse(left.occurredAt ?? "1970-01-01");
    });
    return jsonData(results.slice(0, query.data.limit), {
      meta: {
        query: query.data.q,
        requestedType: query.data.type,
        totalMatches: results.length,
        returned: Math.min(results.length, query.data.limit),
        requestId,
        dataClassification: "demonstration",
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      },
    });
  } catch {
    return jsonError(503, "search_unavailable", "Search is temporarily unavailable.", {
      requestId,
    });
  }
}
