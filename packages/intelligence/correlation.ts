import type { IntelligenceEvent, SourceReport } from "@/packages/shared/types";
import {
  distanceInKilometers,
  hoursBetween,
  sharedTerms,
  tokenSimilarity,
} from "./text";

export type CorrelationSignalCode =
  | "external-id-match"
  | "nearby-location"
  | "same-category"
  | "similar-title"
  | "similar-description"
  | "shared-entity"
  | "shared-keyword"
  | "time-proximity"
  | "major-contradiction"
  | "different-country";

export interface CorrelationSignal {
  code: CorrelationSignalCode;
  score: number;
  explanation: string;
}

export interface CorrelationContext {
  eventReports?: readonly SourceReport[];
  reportEntityIds?: readonly string[];
  reportKeywords?: readonly string[];
  majorContradiction?: boolean;
}

export interface CorrelationScore {
  eventId: string;
  score: number;
  decision: "associate" | "possible-match" | "new-event";
  signals: CorrelationSignal[];
  geographicDistanceKm?: number;
  titleSimilarity: number;
}

export interface CorrelationOptions {
  associationThreshold: number;
  possibleMatchThreshold: number;
  closeDistanceKm: number;
  extendedDistanceKm: number;
  closeTimeHours: number;
  extendedTimeHours: number;
  titleSimilarityThreshold: number;
  descriptionSimilarityThreshold: number;
}

export const DEFAULT_CORRELATION_OPTIONS: Readonly<CorrelationOptions> = {
  associationThreshold: 60,
  possibleMatchThreshold: 35,
  closeDistanceKm: 25,
  extendedDistanceKm: 100,
  closeTimeHours: 6,
  extendedTimeHours: 24,
  titleSimilarityThreshold: 0.62,
  descriptionSimilarityThreshold: 0.55,
};

function addSignal(
  signals: CorrelationSignal[],
  code: CorrelationSignalCode,
  score: number,
  explanation: string,
): void {
  signals.push({ code, score, explanation });
}

export function scoreEventCorrelation(
  report: SourceReport,
  event: IntelligenceEvent,
  context: CorrelationContext = {},
  options: Partial<CorrelationOptions> = {},
): CorrelationScore {
  const config = { ...DEFAULT_CORRELATION_OPTIONS, ...options };
  const signals: CorrelationSignal[] = [];
  const eventReports = context.eventReports ?? [];

  if (
    report.externalId &&
    eventReports.some(
      (eventReport) =>
        eventReport.externalId === report.externalId && eventReport.sourceId === report.sourceId,
    )
  ) {
    addSignal(
      signals,
      "external-id-match",
      100,
      "An existing report on this event has the same source-scoped external identifier.",
    );
  }

  let geographicDistanceKm: number | undefined;
  if (
    report.latitude !== undefined &&
    report.longitude !== undefined &&
    event.latitude !== undefined &&
    event.longitude !== undefined
  ) {
    geographicDistanceKm = distanceInKilometers(
      report.latitude,
      report.longitude,
      event.latitude,
      event.longitude,
    );
    if (geographicDistanceKm <= config.closeDistanceKm) {
      addSignal(
        signals,
        "nearby-location",
        30,
        `Locations are ${geographicDistanceKm.toFixed(1)} km apart.`,
      );
    } else if (geographicDistanceKm <= config.extendedDistanceKm) {
      addSignal(
        signals,
        "nearby-location",
        15,
        `Locations are ${geographicDistanceKm.toFixed(1)} km apart.`,
      );
    }
  }

  if (report.category && report.category === event.category) {
    addSignal(signals, "same-category", 15, `Both records are classified as ${event.category}.`);
  }

  const titleSimilarity = tokenSimilarity(report.title, event.title);
  if (titleSimilarity >= config.titleSimilarityThreshold) {
    addSignal(
      signals,
      "similar-title",
      Math.round(10 + titleSimilarity * 15),
      `Title token similarity is ${Math.round(titleSimilarity * 100)}%.`,
    );
  }

  const descriptionSimilarity = tokenSimilarity(report.description ?? "", event.summary);
  if (descriptionSimilarity >= config.descriptionSimilarityThreshold) {
    addSignal(
      signals,
      "similar-description",
      Math.round(5 + descriptionSimilarity * 10),
      `Description-to-summary similarity is ${Math.round(descriptionSimilarity * 100)}%.`,
    );
  }

  const sharedEntities = sharedTerms(context.reportEntityIds ?? [], event.entityIds);
  if (sharedEntities.length > 0) {
    addSignal(
      signals,
      "shared-entity",
      Math.min(30, sharedEntities.length * 20),
      `Shared entities: ${sharedEntities.join(", ")}.`,
    );
  }

  const sharedKeywords = sharedTerms(context.reportKeywords ?? [], event.tags);
  if (sharedKeywords.length > 0) {
    addSignal(
      signals,
      "shared-keyword",
      Math.min(15, sharedKeywords.length * 5),
      `Shared keywords: ${sharedKeywords.join(", ")}.`,
    );
  }

  const timeDifferenceHours = hoursBetween(report.publishedAt, event.lastUpdatedAt);
  if (timeDifferenceHours !== null && timeDifferenceHours <= config.closeTimeHours) {
    addSignal(
      signals,
      "time-proximity",
      10,
      `Report and event activity are ${timeDifferenceHours.toFixed(1)} hours apart.`,
    );
  } else if (timeDifferenceHours !== null && timeDifferenceHours <= config.extendedTimeHours) {
    addSignal(
      signals,
      "time-proximity",
      5,
      `Report and event activity are ${timeDifferenceHours.toFixed(1)} hours apart.`,
    );
  }

  if (context.majorContradiction) {
    addSignal(
      signals,
      "major-contradiction",
      -30,
      "A major factual contradiction was detected and requires analyst review.",
    );
  }

  if (report.countryCode && event.countryCode && report.countryCode !== event.countryCode) {
    addSignal(
      signals,
      "different-country",
      -20,
      `Country codes differ (${report.countryCode} versus ${event.countryCode}).`,
    );
  }

  const score = signals.reduce((sum, signal) => sum + signal.score, 0);
  const decision =
    score >= config.associationThreshold
      ? "associate"
      : score >= config.possibleMatchThreshold
        ? "possible-match"
        : "new-event";

  return {
    eventId: event.id,
    score,
    decision,
    signals,
    geographicDistanceKm,
    titleSimilarity,
  };
}

export function correlateReportToEvents(
  report: SourceReport,
  events: readonly IntelligenceEvent[],
  contextByEventId: Readonly<Record<string, CorrelationContext>> = {},
  options: Partial<CorrelationOptions> = {},
): CorrelationScore[] {
  return events
    .map((event) =>
      scoreEventCorrelation(report, event, contextByEventId[event.id], options),
    )
    .sort((left, right) => right.score - left.score || left.eventId.localeCompare(right.eventId));
}
