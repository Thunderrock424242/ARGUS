import type {
  ConfidenceAssessment,
  ConfidenceFactor,
  ConfidenceFactorCode,
  ConfidenceLabel,
  IntelligenceClaim,
  IntelligenceSource,
  SourceReport,
} from "@/packages/shared/types";
import { clamp, distanceInKilometers, hoursBetween, tokenSimilarity } from "./text";

export const CONFIDENCE_MODEL_VERSION = "argus-rules-v1.0.0";

export interface ConfidenceEvidence {
  reports: readonly SourceReport[];
  sources: readonly IntelligenceSource[];
  claims?: readonly IntelligenceClaim[];
  calculatedAt?: string;
  officialSourceIds?: readonly string[];
  structuredEvidenceReportIds?: readonly string[];
  mediaReportIds?: readonly string[];
  socialReportIds?: readonly string[];
  anonymousReportIds?: readonly string[];
  matchingExternalIdReportIds?: readonly string[];
  majorContradictionReportIds?: readonly string[];
  detailConsistency?: number;
  staleAfterHours?: number;
}

export function confidenceLabelForScore(score: number): ConfidenceLabel {
  if (score <= 24) return "unverified";
  if (score <= 49) return "low";
  if (score <= 69) return "moderate";
  if (score <= 89) return "high";
  return "strongly-corroborated";
}

function factor(
  code: ConfidenceFactorCode,
  label: string,
  description: string,
  direction: ConfidenceFactor["direction"],
  weight: number,
  appliedScore: number,
  reportIds: readonly string[],
): ConfidenceFactor {
  return {
    id: `confidence-${code}`,
    code,
    label,
    description,
    direction,
    weight: Math.abs(weight),
    appliedScore,
    reportIds: [...new Set(reportIds)],
  };
}

function getSourcesById(sources: readonly IntelligenceSource[]): Map<string, IntelligenceSource> {
  return new Map(sources.map((source) => [source.id, source]));
}

function reportsWithTimeAndLocation(reports: readonly SourceReport[]): SourceReport[] {
  return reports.filter(
    (report) =>
      Number.isFinite(Date.parse(report.publishedAt)) &&
      (Boolean(report.countryCode) ||
        (report.latitude !== undefined && report.longitude !== undefined)),
  );
}

function locationAndTimeAreConsistent(reports: readonly SourceReport[]): boolean {
  if (reports.length < 2) return false;
  const anchor = reports[0];

  return reports.slice(1).some((candidate) => {
    const closeInTime = (hoursBetween(anchor.publishedAt, candidate.publishedAt) ?? Infinity) <= 24;
    const sameCountry = Boolean(
      anchor.countryCode && candidate.countryCode && anchor.countryCode === candidate.countryCode,
    );
    const closeCoordinates =
      anchor.latitude !== undefined &&
      anchor.longitude !== undefined &&
      candidate.latitude !== undefined &&
      candidate.longitude !== undefined &&
      distanceInKilometers(
        anchor.latitude,
        anchor.longitude,
        candidate.latitude,
        candidate.longitude,
      ) <= 100;
    return closeInTime && (sameCountry || closeCoordinates);
  });
}

function inferredDetailConsistency(reports: readonly SourceReport[]): number {
  if (reports.length < 2) return 0;
  const comparisons: number[] = [];
  for (let index = 0; index < reports.length - 1; index += 1) {
    comparisons.push(tokenSimilarity(reports[index].title, reports[index + 1].title));
  }
  return comparisons.reduce((total, value) => total + value, 0) / comparisons.length;
}

function hasSensationalLanguage(report: SourceReport): boolean {
  const text = `${report.title} ${report.description ?? ""}`;
  return /\b(shocking|unbelievable|you won't believe|explosive secret|total chaos|apocalypse|must see)\b/i.test(
    text,
  );
}

/**
 * Applies deterministic, inspectable verification rules. The returned value is
 * an automated confidence score, not a probability and never manual truth.
 */
export function assessConfidence(evidence: ConfidenceEvidence): ConfidenceAssessment {
  const reports = evidence.reports.filter((report) => report.processingStatus !== "rejected");
  const sourceById = getSourcesById(evidence.sources);
  const calculatedAt = evidence.calculatedAt ?? new Date().toISOString();
  const positiveFactors: ConfidenceFactor[] = [];
  const negativeFactors: ConfidenceFactor[] = [];

  if (reports.length === 0) {
    negativeFactors.push(
      factor(
        "missing-time-or-location",
        "No usable evidence",
        "No accepted reports are available for automated assessment.",
        "negative",
        20,
        -20,
        [],
      ),
    );
    return {
      score: 0,
      label: "unverified",
      positiveFactors,
      negativeFactors,
      calculatedAt,
      modelVersion: CONFIDENCE_MODEL_VERSION,
      explanation:
        "Automated confidence is 0% because no accepted evidence is available. This is a rule-coverage score, not a probability.",
    };
  }

  let score = 20;
  const officialSourceIds = new Set(evidence.officialSourceIds ?? []);
  const officialReports = reports.filter((report) => officialSourceIds.has(report.sourceId));
  if (officialReports.length > 0) {
    const applied = Math.min(20, 12 + (officialReports.length - 1) * 4);
    positiveFactors.push(
      factor(
        "official-source",
        "Official source evidence",
        `${officialReports.length} report(s) came from sources explicitly designated as official.`,
        "positive",
        20,
        applied,
        officialReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const independenceGroups = new Map<string, SourceReport[]>();
  for (const report of reports.filter((candidate) => !candidate.duplicateOfReportId)) {
    const source = sourceById.get(report.sourceId);
    const group = source?.independenceGroup ?? `unknown:${report.sourceId}`;
    independenceGroups.set(group, [...(independenceGroups.get(group) ?? []), report]);
  }
  if (independenceGroups.size >= 2) {
    const applied = Math.min(24, 8 + (independenceGroups.size - 1) * 5);
    positiveFactors.push(
      factor(
        "independent-sources",
        "Independent corroboration",
        `${independenceGroups.size} distinct source-independence groups contribute evidence.`,
        "positive",
        24,
        applied,
        [...independenceGroups.values()].map((groupReports) => groupReports[0].id),
      ),
    );
    score += applied;
  }

  const ratedReports = reports.filter((report) => sourceById.has(report.sourceId));
  const averageReliability = ratedReports.length
    ? ratedReports.reduce(
        (sum, report) => sum + (sourceById.get(report.sourceId)?.reliabilityScore ?? 0),
        0,
      ) / ratedReports.length
    : 0;
  if (averageReliability >= 70) {
    const applied = Math.round(Math.min(16, (averageReliability - 55) * 0.35));
    positiveFactors.push(
      factor(
        "source-reliability",
        "Source reliability",
        `Contributing sources have an average configured reliability of ${Math.round(averageReliability)}/100.`,
        "positive",
        16,
        applied,
        ratedReports.map((report) => report.id),
      ),
    );
    score += applied;
  } else if (averageReliability > 0 && averageReliability < 45) {
    const applied = -Math.round(Math.min(16, (55 - averageReliability) * 0.4));
    negativeFactors.push(
      factor(
        "low-reliability-source",
        "Low-reliability sourcing",
        `Contributing sources average ${Math.round(averageReliability)}/100 configured reliability.`,
        "negative",
        16,
        applied,
        ratedReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const locatedReports = reportsWithTimeAndLocation(reports);
  if (locationAndTimeAreConsistent(locatedReports)) {
    positiveFactors.push(
      factor(
        "time-location-match",
        "Matching time and location",
        "At least two reports align within 24 hours and 100 km or identify the same country.",
        "positive",
        12,
        12,
        locatedReports.map((report) => report.id),
      ),
    );
    score += 12;
  }

  const externalIdReports = reports.filter((report) =>
    new Set(evidence.matchingExternalIdReportIds ?? []).has(report.id),
  );
  if (externalIdReports.length > 0) {
    positiveFactors.push(
      factor(
        "external-id-match",
        "Matching structured identifier",
        "Structured records share an event identifier supplied by their providers.",
        "positive",
        10,
        10,
        externalIdReports.map((report) => report.id),
      ),
    );
    score += 10;
  }

  const structuredReports = reports.filter((report) =>
    new Set(evidence.structuredEvidenceReportIds ?? []).has(report.id),
  );
  if (structuredReports.length > 0) {
    const applied = Math.min(14, 8 + structuredReports.length * 2);
    positiveFactors.push(
      factor(
        "structured-evidence",
        "Structured or sensor evidence",
        `${structuredReports.length} report(s) contain structured API, dataset, or sensor evidence.`,
        "positive",
        14,
        applied,
        structuredReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const mediaReports = reports.filter((report) => new Set(evidence.mediaReportIds ?? []).has(report.id));
  if (mediaReports.length > 0) {
    const applied = Math.min(6, 3 + mediaReports.length);
    positiveFactors.push(
      factor(
        "supporting-media",
        "Supporting media",
        `${mediaReports.length} report(s) include media explicitly marked for analyst review.`,
        "positive",
        6,
        applied,
        mediaReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const consistency = evidence.detailConsistency ?? inferredDetailConsistency(reports);
  if (consistency >= 0.5) {
    const applied = Math.round(Math.min(10, consistency * 10));
    positiveFactors.push(
      factor(
        "detail-consistency",
        "Consistent factual details",
        `Cross-report detail consistency is ${Math.round(consistency * 100)}%.`,
        "positive",
        10,
        applied,
        reports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const explicitAnonymousIds = new Set(evidence.anonymousReportIds ?? []);
  const anonymousReports = reports.filter(
    (report) => explicitAnonymousIds.has(report.id) || (!report.author && !officialSourceIds.has(report.sourceId)),
  );
  if (anonymousReports.length === reports.length && officialReports.length === 0) {
    negativeFactors.push(
      factor(
        "anonymous-only",
        "Anonymous-only sourcing",
        "Every available report lacks a named author and no source is explicitly designated official.",
        "negative",
        12,
        -12,
        anonymousReports.map((report) => report.id),
      ),
    );
    score -= 12;
  }

  const circularReports = reports.filter(
    (report) =>
      Boolean(report.duplicateOfReportId) ||
      ((independenceGroups.get(sourceById.get(report.sourceId)?.independenceGroup ?? "")?.length ?? 0) > 1),
  );
  if (reports.length >= 2 && independenceGroups.size < reports.length && circularReports.length > 0) {
    const applied = -Math.min(18, 6 + circularReports.length * 3);
    negativeFactors.push(
      factor(
        "circular-reporting",
        "Circular or syndicated reporting",
        "Some reports are duplicates or belong to the same source-independence group and are not counted as separate corroboration.",
        "negative",
        18,
        applied,
        circularReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const disputedClaimReportIds = (evidence.claims ?? [])
    .filter((claim) => claim.status === "disputed")
    .flatMap((claim) => claim.contradictingReportIds);
  const contradictionReportIds = [
    ...new Set([...(evidence.majorContradictionReportIds ?? []), ...disputedClaimReportIds]),
  ];
  if (contradictionReportIds.length > 0) {
    const applied = -Math.min(28, 18 + contradictionReportIds.length * 3);
    negativeFactors.push(
      factor(
        "major-contradiction",
        "Major contradiction",
        "Evidence materially contradicts one or more event claims and requires analyst review.",
        "negative",
        28,
        applied,
        contradictionReportIds,
      ),
    );
    score += applied;
  }

  const missingLocationOrTimeReports = reports.filter(
    (report) =>
      !Number.isFinite(Date.parse(report.publishedAt)) ||
      (!report.countryCode && (report.latitude === undefined || report.longitude === undefined)),
  );
  if (missingLocationOrTimeReports.length > 0) {
    const proportion = missingLocationOrTimeReports.length / reports.length;
    const applied = -Math.max(3, Math.round(proportion * 10));
    negativeFactors.push(
      factor(
        "missing-time-or-location",
        "Missing time or location",
        `${missingLocationOrTimeReports.length} of ${reports.length} report(s) lack a usable timestamp or location.`,
        "negative",
        10,
        applied,
        missingLocationOrTimeReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const sensationalReports = reports.filter(hasSensationalLanguage);
  if (sensationalReports.length > 0) {
    const applied = -Math.min(10, 4 + sensationalReports.length * 2);
    negativeFactors.push(
      factor(
        "sensational-language",
        "Sensational wording",
        "Rule-based wording checks found sensational phrases; this is a review signal, not a truth judgment.",
        "negative",
        10,
        applied,
        sensationalReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const newestEvidenceTime = Math.max(...reports.map((report) => Date.parse(report.publishedAt)).filter(Number.isFinite));
  const staleAfterHours = evidence.staleAfterHours ?? 72;
  const staleReports = reports.filter((report) => {
    const reportTime = Date.parse(report.publishedAt);
    return (
      Number.isFinite(newestEvidenceTime) &&
      Number.isFinite(reportTime) &&
      (newestEvidenceTime - reportTime) / 3_600_000 > staleAfterHours
    );
  });
  if (staleReports.length > 0) {
    const applied = -Math.min(8, 3 + staleReports.length);
    negativeFactors.push(
      factor(
        "stale-evidence",
        "Stale related evidence",
        `${staleReports.length} report(s) are more than ${staleAfterHours} hours older than the newest evidence.`,
        "negative",
        8,
        applied,
        staleReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const socialReportIds = new Set(evidence.socialReportIds ?? []);
  const unsupportedSocialReports = reports.filter((report) => socialReportIds.has(report.id));
  if (
    unsupportedSocialReports.length > 0 &&
    independenceGroups.size <= 1 &&
    officialReports.length === 0
  ) {
    const applied = -Math.min(18, 10 + unsupportedSocialReports.length * 2);
    negativeFactors.push(
      factor(
        "unsupported-social-claim",
        "Unsupported social-media claim",
        "Social-source reporting has no independent or official corroboration in the available evidence.",
        "negative",
        18,
        applied,
        unsupportedSocialReports.map((report) => report.id),
      ),
    );
    score += applied;
  }

  const finalScore = Math.round(clamp(score, 0, 99));
  const label = confidenceLabelForScore(finalScore);
  const positiveTotal = positiveFactors.reduce((sum, item) => sum + item.appliedScore, 0);
  const negativeTotal = negativeFactors.reduce((sum, item) => sum + item.appliedScore, 0);

  return {
    score: finalScore,
    label,
    positiveFactors,
    negativeFactors,
    calculatedAt,
    modelVersion: CONFIDENCE_MODEL_VERSION,
    explanation: `Automated confidence is ${finalScore}% (${label}). ARGUS began with a 20-point evidence baseline, applied ${positiveTotal} positive and ${Math.abs(negativeTotal)} negative points, then capped the rule-coverage score at 99. It is not a mathematical probability or analyst verification.`,
  };
}
