import type { SourceReport, VerificationState } from "@/packages/shared/types";

/** Unreviewed public information is visible, but deliberately starts at low confidence. */
export const PUBLIC_INFORMATION_INITIAL_CONFIDENCE = 25;

/** Approval establishes a moderate default; it does not assert certainty. */
export const PUBLIC_INFORMATION_APPROVED_CONFIDENCE = 60;

export function publicInformationConfidence(report: SourceReport): number {
  if (report.dataClassification !== "public-information") return 99;
  return Math.max(0, Math.min(99, Math.round(report.confidence ?? PUBLIC_INFORMATION_INITIAL_CONFIDENCE)));
}

export function publicInformationVerificationState(report: SourceReport): VerificationState {
  if (report.dataClassification !== "public-information") return report.verificationState ?? "automated";
  return report.verificationState ?? "needs-review";
}
