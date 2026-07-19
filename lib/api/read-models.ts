import type { SourceReport } from "@/packages/shared/types";

export const DEMONSTRATION_DATA_LABEL =
  "Demonstration data — not real-world intelligence";

export function normalizedSearchText(...values: unknown[]): string {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .normalize("NFKD")
    .toLocaleLowerCase("en-US");
}

export function paginate<T>(
  values: readonly T[],
  page: number,
  limit: number,
): { items: T[]; total: number; totalPages: number } {
  const total = values.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  return { items: values.slice(offset, offset + limit), total, totalPages };
}

/** Raw collector payloads stay server-side in list APIs. */
export function publicReportView(report: SourceReport): Omit<SourceReport, "rawPayload"> {
  const { rawPayload: _rawPayload, ...view } = report;
  void _rawPayload;
  return view;
}

export function parseTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
