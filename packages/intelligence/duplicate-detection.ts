import type { IntelligenceSource, SourceReport } from "@/packages/shared/types";
import { clamp, normalizeText, normalizeUrl, tokenSimilarity } from "./text";

export type DuplicateReasonCode =
  | "external-id"
  | "normalized-url"
  | "content-hash"
  | "similar-title"
  | "similar-body"
  | "syndicated-copy";

export interface DuplicateReason {
  code: DuplicateReasonCode;
  description: string;
  score: number;
  similarity?: number;
}

export interface DuplicateCandidate {
  reportId: string;
  score: number;
  classification: "exact" | "probable" | "possible";
  reasons: DuplicateReason[];
  shouldCountAsIndependentEvidence: boolean;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateOfReportId?: string;
  confidence: "exact" | "probable" | "possible" | "none";
  candidates: DuplicateCandidate[];
}

export interface DuplicateDetectionOptions {
  titleSimilarityThreshold: number;
  bodySimilarityThreshold: number;
  possibleScoreThreshold: number;
  probableScoreThreshold: number;
  sources?: readonly IntelligenceSource[];
}

export const DEFAULT_DUPLICATE_OPTIONS: Readonly<DuplicateDetectionOptions> = {
  titleSimilarityThreshold: 0.78,
  bodySimilarityThreshold: 0.82,
  possibleScoreThreshold: 20,
  probableScoreThreshold: 50,
};

function sourceIndependenceGroup(
  sourceId: string,
  sources: readonly IntelligenceSource[] | undefined,
): string | undefined {
  return sources?.find((source) => source.id === sourceId)?.independenceGroup;
}

function classifyCandidate(
  reasons: readonly DuplicateReason[],
  score: number,
  probableThreshold: number,
): DuplicateCandidate["classification"] {
  if (reasons.some((reason) => ["external-id", "normalized-url", "content-hash"].includes(reason.code))) {
    return "exact";
  }
  return score >= probableThreshold ? "probable" : "possible";
}

export function compareReportsForDuplication(
  incoming: SourceReport,
  candidate: SourceReport,
  options: Partial<DuplicateDetectionOptions> = {},
): DuplicateCandidate | null {
  if (incoming.id === candidate.id) return null;

  const config = { ...DEFAULT_DUPLICATE_OPTIONS, ...options };
  const reasons: DuplicateReason[] = [];

  if (
    incoming.externalId &&
    candidate.externalId &&
    incoming.sourceId === candidate.sourceId &&
    normalizeText(incoming.externalId) === normalizeText(candidate.externalId)
  ) {
    reasons.push({
      code: "external-id",
      description: "The same source supplied the same external identifier.",
      score: 100,
    });
  }

  const incomingUrl = incoming.normalizedUrl ?? normalizeUrl(incoming.url);
  const candidateUrl = candidate.normalizedUrl ?? normalizeUrl(candidate.url);
  if (incomingUrl && candidateUrl && incomingUrl === candidateUrl) {
    reasons.push({
      code: "normalized-url",
      description: "URLs match after tracking parameters and fragments are removed.",
      score: 100,
    });
  }

  if (
    incoming.contentHash &&
    candidate.contentHash &&
    incoming.contentHash.toLocaleLowerCase("en-US") === candidate.contentHash.toLocaleLowerCase("en-US")
  ) {
    reasons.push({
      code: "content-hash",
      description: "Normalized report content hashes are identical.",
      score: 100,
    });
  }

  const titleSimilarity = tokenSimilarity(incoming.title, candidate.title);
  if (titleSimilarity >= config.titleSimilarityThreshold) {
    reasons.push({
      code: "similar-title",
      description: `Title token similarity is ${Math.round(titleSimilarity * 100)}%.`,
      score: Math.round(15 + titleSimilarity * 20),
      similarity: titleSimilarity,
    });
  }

  const incomingBody = incoming.bodyText ?? incoming.description ?? "";
  const candidateBody = candidate.bodyText ?? candidate.description ?? "";
  const bodySimilarity = incomingBody && candidateBody ? tokenSimilarity(incomingBody, candidateBody) : 0;
  if (bodySimilarity >= config.bodySimilarityThreshold) {
    reasons.push({
      code: "similar-body",
      description: `Body token similarity is ${Math.round(bodySimilarity * 100)}%.`,
      score: Math.round(15 + bodySimilarity * 25),
      similarity: bodySimilarity,
    });
  }

  const incomingGroup = sourceIndependenceGroup(incoming.sourceId, config.sources);
  const candidateGroup = sourceIndependenceGroup(candidate.sourceId, config.sources);
  const sameIndependenceGroup = Boolean(
    incomingGroup && candidateGroup && incomingGroup === candidateGroup,
  );
  if (
    sameIndependenceGroup &&
    (titleSimilarity >= config.titleSimilarityThreshold || bodySimilarity >= config.bodySimilarityThreshold)
  ) {
    reasons.push({
      code: "syndicated-copy",
      description: `Sources belong to the same independence group (${incomingGroup}).`,
      score: 25,
    });
  }

  if (reasons.length === 0) return null;

  const hasExactReason = reasons.some((reason) => reason.score === 100);
  const score = hasExactReason
    ? 100
    : clamp(reasons.reduce((total, reason) => total + reason.score, 0), 0, 99);
  if (score < config.possibleScoreThreshold) return null;

  return {
    reportId: candidate.id,
    score,
    classification: classifyCandidate(reasons, score, config.probableScoreThreshold),
    reasons,
    shouldCountAsIndependentEvidence: !sameIndependenceGroup && !hasExactReason,
  };
}

export function detectDuplicateReport(
  incoming: SourceReport,
  existingReports: readonly SourceReport[],
  options: Partial<DuplicateDetectionOptions> = {},
): DuplicateDetectionResult {
  const candidates = existingReports
    .map((candidate) => compareReportsForDuplication(incoming, candidate, options))
    .filter((candidate): candidate is DuplicateCandidate => candidate !== null)
    .sort((left, right) => right.score - left.score || left.reportId.localeCompare(right.reportId));

  const best = candidates[0];
  const isDuplicate = best?.classification === "exact" || best?.classification === "probable";

  return {
    isDuplicate: Boolean(isDuplicate),
    duplicateOfReportId: isDuplicate ? best.reportId : undefined,
    confidence: best?.classification ?? "none",
    candidates,
  };
}
