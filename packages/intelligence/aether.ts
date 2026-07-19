import { intelligenceDataProvider } from "@/packages/database/provider";
import type {
  AetherProvider,
  AetherResponse,
  IntelligenceDataProvider,
  IntelligenceEvent,
  SourceReport,
} from "@/packages/shared/types";
import { tokenize } from "./text";

export const AETHER_DEMO_DISCLOSURE =
  "Aether-generated demonstration analysis — deterministic output from fictional ARGUS data.";

function responseMode(prompt: string, hasEventContext: boolean): AetherResponse["mode"] {
  if (/contradict|disput|conflict(?:ing)? report/i.test(prompt)) return "contradiction-analysis";
  if (/compare|source difference|source agreement/i.test(prompt)) return "source-comparison";
  if (/brief|executive summary|daily summary/i.test(prompt)) return "brief-generation";
  return hasEventContext ? "event-context" : "chat";
}

function stableId(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function eventMatchesPrompt(event: IntelligenceEvent, promptTokens: readonly string[]): number {
  const searchable = new Set(tokenize(`${event.title} ${event.summary} ${event.tags.join(" ")}`));
  return promptTokens.filter((token) => searchable.has(token)).length;
}

function summarizeEvents(events: readonly IntelligenceEvent[]): string {
  if (events.length === 0) return "No event records matched the request.";
  return events
    .map(
      (event) =>
        `${event.title} is ${event.status}, severity ${event.severity}, with ${event.automatedConfidence}% automated confidence and analyst state ${event.verificationState}.`,
    )
    .join(" ");
}

function contradictionSummary(events: readonly IntelligenceEvent[]): string {
  const disputedClaims = events.flatMap((event) =>
    event.disputedClaims.map((claim) => ({ event, claim })),
  );
  if (disputedClaims.length === 0) {
    return "The selected demonstration records contain no claim currently marked disputed.";
  }
  return disputedClaims
    .slice(0, 5)
    .map(
      ({ event, claim }) =>
        `${event.title}: “${claim.text}” is disputed, with ${claim.supportingReportIds.length} supporting and ${claim.contradictingReportIds.length} contradicting report reference(s).`,
    )
    .join(" ");
}

function sourceComparison(
  events: readonly IntelligenceEvent[],
  reports: readonly SourceReport[],
): string {
  if (reports.length === 0) return "No source reports are linked to the selected demonstration records.";
  const eventIds = new Set(events.map((event) => event.id));
  const relevantReports = reports.filter((report) => report.eventId && eventIds.has(report.eventId));
  const sourceCount = new Set(relevantReports.map((report) => report.sourceId)).size;
  const duplicateCount = relevantReports.filter((report) => report.processingStatus === "duplicate").length;
  return `${relevantReports.length} linked report(s) from ${sourceCount} source record(s) are available. ${duplicateCount} report(s) are marked duplicate and must not be counted as independent corroboration.`;
}

export class DeterministicAetherProvider implements AetherProvider {
  constructor(
    private readonly dataProvider: IntelligenceDataProvider = intelligenceDataProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async respond(prompt: string, contextEventIds: string[] = []): Promise<AetherResponse> {
    const [events, reports, sources] = await Promise.all([
      this.dataProvider.getEvents(),
      this.dataProvider.getReports(),
      this.dataProvider.getSources(),
    ]);
    const requestedEventIds = new Set(contextEventIds);
    const promptTokens = tokenize(prompt);
    const contextEvents = events.filter((event) => requestedEventIds.has(event.id));
    const selectedEvents =
      contextEvents.length > 0
        ? contextEvents
        : events
            .map((event) => ({ event, score: eventMatchesPrompt(event, promptTokens) }))
            .filter((candidate) => candidate.score > 0)
            .sort(
              (left, right) =>
                right.score - left.score ||
                right.event.severity - left.event.severity ||
                right.event.automatedConfidence - left.event.automatedConfidence,
            )
            .slice(0, 3)
            .map((candidate) => candidate.event);
    const fallbackEvents = selectedEvents.length > 0
      ? selectedEvents
      : events
          .filter((event) => event.priority)
          .sort((left, right) => right.severity - left.severity)
          .slice(0, 3);
    const mode = responseMode(prompt, contextEvents.length > 0);
    const selectedEventIds = new Set(fallbackEvents.map((event) => event.id));
    const selectedReportIds = new Set(fallbackEvents.flatMap((event) => event.sourceReportIds));
    const selectedReports = reports.filter(
      (report) => selectedReportIds.has(report.id) || Boolean(report.eventId && selectedEventIds.has(report.eventId)),
    );
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const citations = selectedReports.slice(0, 8).map((report) => ({
      reportId: report.id,
      sourceId: report.sourceId,
      label: `${sourceById.get(report.sourceId)?.name ?? "Stored source"}: ${report.title}`,
    }));

    const analysis =
      mode === "contradiction-analysis"
        ? contradictionSummary(fallbackEvents)
        : mode === "source-comparison"
          ? sourceComparison(fallbackEvents, reports)
          : summarizeEvents(fallbackEvents);
    const generatedAt = this.now().toISOString();
    const confidenceExplanation = fallbackEvents.length
      ? fallbackEvents
          .map(
            (event) =>
              `${event.title}: ${event.confidenceAssessment.explanation}`,
          )
          .join(" ")
      : "No automated confidence assessment is available because no event matched.";

    return {
      id: `aether-${stableId(`${generatedAt}:${prompt}:${fallbackEvents.map((event) => event.id).join(",")}`)}`,
      mode,
      generatedAt,
      answer: `${AETHER_DEMO_DISCLOSURE} ${analysis}`,
      evidenceSummary: `${citations.length} stored report citation(s) support this response. Citations are omitted when no stored report is available.`,
      citations,
      relatedEventIds: fallbackEvents.map((event) => event.id),
      confidenceExplanation,
      generatedBy: "Aether",
      dataClassification: "demonstration",
    };
  }
}

export const aetherProvider: AetherProvider = new DeterministicAetherProvider();
