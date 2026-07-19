import type {
  ConfidenceAssessment,
  EventCategory,
  IntelligenceClaim,
  IntelligenceEntity,
  IntelligenceEvent,
  IntelligenceSource,
  SourceReport,
} from "@/packages/shared/types";
import { assessConfidence, type ConfidenceEvidence } from "./confidence";
import {
  correlateReportToEvents,
  type CorrelationContext,
  type CorrelationScore,
} from "./correlation";
import {
  detectDuplicateReport,
  type DuplicateDetectionResult,
} from "./duplicate-detection";
import { normalizeText, normalizeUrl, normalizeWhitespace, tokenSimilarity } from "./text";

export type PipelineOutcome =
  | "processing"
  | "rejected"
  | "duplicate"
  | "associated"
  | "possible-match"
  | "create-event";

export interface PipelineStageAudit {
  stageId: string;
  startedAt: string;
  completedAt: string;
  status: "completed" | "skipped" | "failed";
  message: string;
}

export interface ReportProcessingContext {
  source: IntelligenceSource;
  existingReports: readonly SourceReport[];
  existingEvents: readonly IntelligenceEvent[];
  allSources: readonly IntelligenceSource[];
  knownEntities?: readonly IntelligenceEntity[];
  now?: string;
  officialSourceIds?: readonly string[];
  structuredEvidenceReportIds?: readonly string[];
  mediaReportIds?: readonly string[];
  socialReportIds?: readonly string[];
}

export interface ReportProcessingState {
  report: SourceReport;
  context: ReportProcessingContext;
  outcome: PipelineOutcome;
  halted: boolean;
  validationErrors: string[];
  duplicate?: DuplicateDetectionResult;
  extractedEntityIds: string[];
  extractedKeywords: string[];
  classifiedCategory?: EventCategory;
  correlationCandidates: CorrelationScore[];
  associatedEventId?: string;
  extractedClaims: IntelligenceClaim[];
  contradictionReportIds: string[];
  confidenceAssessment?: ConfidenceAssessment;
  audit: PipelineStageAudit[];
}

export interface ProcessingStage {
  id: string;
  label: string;
  execute(state: ReportProcessingState): Promise<ReportProcessingState> | ReportProcessingState;
}

function stageTime(state: ReportProcessingState): string {
  return state.context.now ?? new Date().toISOString();
}

function completedAudit(
  state: ReportProcessingState,
  stage: ProcessingStage,
  startedAt: string,
  status: PipelineStageAudit["status"],
  message: string,
): ReportProcessingState {
  return {
    ...state,
    audit: [
      ...state.audit,
      {
        stageId: stage.id,
        startedAt,
        completedAt: stageTime(state),
        status,
        message,
      },
    ],
  };
}

function stableIdentifier(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function isValidLatitude(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= -90 && value <= 90);
}

function isValidLongitude(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= -180 && value <= 180);
}

export const validatePayloadStage: ProcessingStage = {
  id: "validate-payload",
  label: "Validate payload",
  execute(state) {
    const startedAt = stageTime(state);
    const errors: string[] = [];
    if (!state.report.id.trim()) errors.push("Report ID is required.");
    if (!state.report.title.trim()) errors.push("Report title is required.");
    if (!state.report.url.trim()) errors.push("Report URL is required.");
    try {
      const url = new URL(state.report.url);
      if (!new Set(["https:", "http:"]).has(url.protocol)) {
        errors.push("Report URL must use HTTP or HTTPS.");
      }
    } catch {
      errors.push("Report URL is invalid.");
    }
    if (!Number.isFinite(Date.parse(state.report.publishedAt))) {
      errors.push("Published timestamp is invalid.");
    }
    if (!Number.isFinite(Date.parse(state.report.collectedAt))) {
      errors.push("Collection timestamp is invalid.");
    }
    if (!isValidLatitude(state.report.latitude)) errors.push("Latitude must be between -90 and 90.");
    if (!isValidLongitude(state.report.longitude)) errors.push("Longitude must be between -180 and 180.");
    if (state.report.sourceId !== state.context.source.id) {
      errors.push("Report source does not match the collector context.");
    }

    const nextState: ReportProcessingState = {
      ...state,
      validationErrors: errors,
      outcome: errors.length > 0 ? "rejected" : state.outcome,
      halted: errors.length > 0,
      report:
        errors.length > 0
          ? {
              ...state.report,
              processingStatus: "rejected",
              rejectionReason: errors.join(" "),
            }
          : state.report,
    };
    return completedAudit(
      nextState,
      validatePayloadStage,
      startedAt,
      "completed",
      errors.length > 0 ? errors.join(" ") : "Payload passed structural validation.",
    );
  },
};

export const normalizeFieldsStage: ProcessingStage = {
  id: "normalize-fields",
  label: "Normalize fields",
  execute(state) {
    const startedAt = stageTime(state);
    const report: SourceReport = {
      ...state.report,
      title: normalizeWhitespace(state.report.title),
      description: state.report.description
        ? normalizeWhitespace(state.report.description)
        : undefined,
      bodyText: state.report.bodyText ? normalizeWhitespace(state.report.bodyText) : undefined,
      author: state.report.author ? normalizeWhitespace(state.report.author) : undefined,
      language: state.report.language?.toLocaleLowerCase("en-US") ?? "und",
      countryCode: state.report.countryCode?.toLocaleUpperCase("en-US"),
      normalizedUrl: normalizeUrl(state.report.url),
      processingStatus: "processing",
    };
    return completedAudit(
      { ...state, report },
      normalizeFieldsStage,
      startedAt,
      "completed",
      "Text, locale, country code, and canonical URL were normalized.",
    );
  },
};

export const detectExactDuplicateStage: ProcessingStage = {
  id: "detect-duplicate",
  label: "Detect exact and probable duplicates",
  execute(state) {
    const startedAt = stageTime(state);
    const duplicate = detectDuplicateReport(state.report, state.context.existingReports, {
      sources: state.context.allSources,
    });
    const nextState: ReportProcessingState = duplicate.isDuplicate
      ? {
          ...state,
          duplicate,
          halted: true,
          outcome: "duplicate",
          report: {
            ...state.report,
            processingStatus: "duplicate",
            duplicateOfReportId: duplicate.duplicateOfReportId,
          },
        }
      : { ...state, duplicate };
    return completedAudit(
      nextState,
      detectExactDuplicateStage,
      startedAt,
      "completed",
      duplicate.isDuplicate
        ? `Duplicate of ${duplicate.duplicateOfReportId ?? "an existing report"}.`
        : `${duplicate.candidates.length} possible duplicate candidate(s) retained for review.`,
    );
  },
};

export const extractEntitiesStage: ProcessingStage = {
  id: "extract-entities",
  label: "Extract known entities",
  execute(state) {
    const startedAt = stageTime(state);
    const haystack = normalizeText(
      `${state.report.title} ${state.report.description ?? ""} ${state.report.bodyText ?? ""}`,
    );
    const extractedEntityIds = (state.context.knownEntities ?? [])
      .filter((entity) =>
        [entity.name, ...entity.aliases]
          .map(normalizeText)
          .filter(Boolean)
          .some((candidate) => haystack.includes(candidate)),
      )
      .map((entity) => entity.id);
    return completedAudit(
      { ...state, extractedEntityIds },
      extractEntitiesStage,
      startedAt,
      "completed",
      `Matched ${extractedEntityIds.length} known entity record(s).`,
    );
  },
};

export const extractDateLocationStage: ProcessingStage = {
  id: "extract-date-location",
  label: "Extract date and location",
  execute(state) {
    const startedAt = stageTime(state);
    const hasCoordinates = state.report.latitude !== undefined && state.report.longitude !== undefined;
    const hasLocation = hasCoordinates || Boolean(state.report.countryCode);
    return completedAudit(
      state,
      extractDateLocationStage,
      startedAt,
      "completed",
      hasLocation
        ? "Used structured source location fields; no speculative geocoding was performed."
        : "No structured location was present; report remains location-unresolved.",
    );
  },
};

const CATEGORY_KEYWORDS: Readonly<Record<EventCategory, readonly string[]>> = {
  conflict: ["conflict", "clash", "ceasefire", "missile", "military"],
  political: ["election", "parliament", "minister", "protest", "policy"],
  cyber: ["cyber", "malware", "ransomware", "vulnerability", "breach", "cve"],
  disaster: ["earthquake", "flood", "wildfire", "cyclone", "landslide", "eruption"],
  maritime: ["vessel", "ship", "port", "maritime", "strait"],
  aviation: ["aircraft", "airport", "flight", "aviation", "airspace"],
  health: ["health", "outbreak", "disease", "hospital", "pathogen"],
  infrastructure: ["power", "grid", "bridge", "rail", "infrastructure", "outage"],
  economic: ["market", "inflation", "trade", "currency", "economic"],
  crime: ["crime", "arrest", "fraud", "smuggling", "theft"],
  technology: ["technology", "satellite", "semiconductor", "launch", "research"],
  environment: ["environment", "pollution", "drought", "ecosystem", "climate"],
  local: ["local", "municipal", "county", "community"],
  other: [],
};

export function classifyReportCategory(report: SourceReport): EventCategory {
  if (report.category) return report.category;
  const text = normalizeText(`${report.title} ${report.description ?? ""} ${report.bodyText ?? ""}`);
  let bestCategory: EventCategory = "other";
  let bestScore = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    EventCategory,
    readonly string[],
  ][]) {
    const score = keywords.filter((keyword) => text.includes(keyword)).length;
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }
  return bestCategory;
}

export const classifyCategoryStage: ProcessingStage = {
  id: "classify-category",
  label: "Classify category",
  execute(state) {
    const startedAt = stageTime(state);
    const classifiedCategory = classifyReportCategory(state.report);
    const reportText = normalizeText(
      `${state.report.title} ${state.report.description ?? ""} ${state.report.bodyText ?? ""}`,
    );
    const extractedKeywords = CATEGORY_KEYWORDS[classifiedCategory].filter((keyword) =>
      reportText.includes(keyword),
    );
    return completedAudit(
      {
        ...state,
        classifiedCategory,
        extractedKeywords,
        report: { ...state.report, category: classifiedCategory },
      },
      classifyCategoryStage,
      startedAt,
      "completed",
      `Deterministic keyword classifier selected ${classifiedCategory}.`,
    );
  },
};

export const associateEventStage: ProcessingStage = {
  id: "associate-event",
  label: "Associate report with an event",
  execute(state) {
    const startedAt = stageTime(state);
    const contextByEventId: Record<string, CorrelationContext> = {};
    for (const event of state.context.existingEvents) {
      contextByEventId[event.id] = {
        eventReports: state.context.existingReports.filter((report) => report.eventId === event.id),
        reportEntityIds: state.extractedEntityIds,
        reportKeywords: state.extractedKeywords,
      };
    }
    const correlationCandidates = correlateReportToEvents(
      state.report,
      state.context.existingEvents,
      contextByEventId,
    );
    const best = correlationCandidates[0];
    const outcome: PipelineOutcome =
      best?.decision === "associate"
        ? "associated"
        : best?.decision === "possible-match"
          ? "possible-match"
          : "create-event";
    const associatedEventId = best?.decision === "associate" ? best.eventId : undefined;
    return completedAudit(
      { ...state, correlationCandidates, outcome, associatedEventId },
      associateEventStage,
      startedAt,
      "completed",
      best
        ? `Best candidate ${best.eventId} scored ${best.score} (${best.decision}).`
        : "No existing event candidates; a new event is recommended.",
    );
  },
};

export function extractClaims(report: SourceReport, createdAt: string): IntelligenceClaim[] {
  const text = normalizeWhitespace(report.bodyText ?? report.description ?? report.title);
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20 && sentence.length <= 320)
    .slice(0, 4);
  const candidates = sentences.length > 0 ? sentences : [report.title];
  return candidates.map((claimText, index) => ({
    id: `claim-${stableIdentifier(`${report.id}:${index}:${claimText}`)}`,
    text: claimText,
    confidence: 25,
    status: "unverified",
    supportingReportIds: [report.id],
    contradictingReportIds: [],
    createdAt,
    updatedAt: createdAt,
  }));
}

export const extractClaimsStage: ProcessingStage = {
  id: "extract-claims",
  label: "Extract factual claim candidates",
  execute(state) {
    const startedAt = stageTime(state);
    const extractedClaims = extractClaims(state.report, startedAt);
    return completedAudit(
      { ...state, extractedClaims },
      extractClaimsStage,
      startedAt,
      "completed",
      `Extracted ${extractedClaims.length} sentence-level claim candidate(s); all remain unverified.`,
    );
  },
};

function reportContradictsClaim(report: SourceReport, claim: IntelligenceClaim): boolean {
  const text = normalizeText(`${report.title} ${report.description ?? ""} ${report.bodyText ?? ""}`);
  const denialLanguage = /\b(denies|denied|false|incorrect|no evidence|did not|has not|not occurred)\b/i.test(
    `${report.title} ${report.description ?? ""} ${report.bodyText ?? ""}`,
  );
  return denialLanguage && tokenSimilarity(text, claim.text) >= 0.25;
}

export const detectContradictionsStage: ProcessingStage = {
  id: "detect-contradictions",
  label: "Detect contradictions",
  execute(state) {
    const startedAt = stageTime(state);
    const associatedEvent = state.context.existingEvents.find(
      (event) => event.id === state.associatedEventId,
    );
    const existingClaims = associatedEvent
      ? [
          ...associatedEvent.confirmedFacts,
          ...associatedEvent.unverifiedClaims,
          ...associatedEvent.disputedClaims,
        ]
      : [];
    const contradictionReportIds = existingClaims.some((claim) =>
      reportContradictsClaim(state.report, claim),
    )
      ? [state.report.id]
      : [];
    return completedAudit(
      { ...state, contradictionReportIds },
      detectContradictionsStage,
      startedAt,
      "completed",
      contradictionReportIds.length > 0
        ? "Rule-based denial language overlaps an existing claim; analyst review is required."
        : "No explicit rule-based contradiction was detected.",
    );
  },
};

export const calculateConfidenceStage: ProcessingStage = {
  id: "calculate-confidence",
  label: "Calculate automated confidence",
  execute(state) {
    const startedAt = stageTime(state);
    const associatedReports = state.associatedEventId
      ? state.context.existingReports.filter((report) => report.eventId === state.associatedEventId)
      : [];
    const confidenceEvidence: ConfidenceEvidence = {
      reports: [...associatedReports, state.report],
      sources: state.context.allSources,
      calculatedAt: startedAt,
      officialSourceIds: state.context.officialSourceIds,
      structuredEvidenceReportIds: state.context.structuredEvidenceReportIds,
      mediaReportIds: state.context.mediaReportIds,
      socialReportIds: state.context.socialReportIds,
      majorContradictionReportIds: state.contradictionReportIds,
    };
    const confidenceAssessment = assessConfidence(confidenceEvidence);
    return completedAudit(
      { ...state, confidenceAssessment },
      calculateConfidenceStage,
      startedAt,
      "completed",
      confidenceAssessment.explanation,
    );
  },
};

export const finalizeStage: ProcessingStage = {
  id: "finalize",
  label: "Finalize report processing",
  execute(state) {
    const startedAt = stageTime(state);
    const report: SourceReport = {
      ...state.report,
      eventId: state.associatedEventId,
      processingStatus: "processed",
    };
    return completedAudit(
      { ...state, report },
      finalizeStage,
      startedAt,
      "completed",
      `Report processing completed with outcome ${state.outcome}.`,
    );
  },
};

export const DEFAULT_PROCESSING_STAGES: readonly ProcessingStage[] = [
  validatePayloadStage,
  normalizeFieldsStage,
  detectExactDuplicateStage,
  extractEntitiesStage,
  extractDateLocationStage,
  classifyCategoryStage,
  associateEventStage,
  extractClaimsStage,
  detectContradictionsStage,
  calculateConfidenceStage,
  finalizeStage,
];

export class ReportProcessingPipeline {
  constructor(private readonly stages: readonly ProcessingStage[] = DEFAULT_PROCESSING_STAGES) {}

  async run(report: SourceReport, context: ReportProcessingContext): Promise<ReportProcessingState> {
    let state: ReportProcessingState = {
      report,
      context,
      outcome: "processing",
      halted: false,
      validationErrors: [],
      extractedEntityIds: [],
      extractedKeywords: [],
      correlationCandidates: [],
      extractedClaims: [],
      contradictionReportIds: [],
      audit: [],
    };

    for (const stage of this.stages) {
      if (state.halted) {
        state = completedAudit(
          state,
          stage,
          stageTime(state),
          "skipped",
          `Skipped because pipeline outcome is ${state.outcome}.`,
        );
        continue;
      }

      try {
        state = await stage.execute(state);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown processing error.";
        state = completedAudit(
          {
            ...state,
            halted: true,
            outcome: "rejected",
            report: { ...state.report, processingStatus: "failed", rejectionReason: message },
          },
          stage,
          stageTime(state),
          "failed",
          message,
        );
      }
    }

    return state;
  }
}

export const defaultProcessingPipeline = new ReportProcessingPipeline();
