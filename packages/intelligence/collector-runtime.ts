import type {
  CollectedReport,
  CollectorContext,
  CollectorRun,
  IntelligenceCollector,
  IntelligenceSource,
} from "@/packages/shared/types";
import { normalizeText, normalizeUrl } from "./text";

export interface CollectorRetryPolicy {
  maximumAttempts: number;
  baseDelayMs: number;
  maximumDelayMs: number;
  jitterRatio: number;
}

export interface CollectorJob {
  id: string;
  collectorId: string;
  sourceId: string;
  scheduledFor: string;
  attempt: number;
  cursor?: string;
  since?: string;
  deadLetterAfter: number;
}

export interface CollectorExecutionResult {
  run: CollectorRun;
  reports: CollectedReport[];
  retryJob?: CollectorJob;
  deadLettered: boolean;
}

export const DEFAULT_COLLECTOR_RETRY_POLICY: Readonly<CollectorRetryPolicy> = {
  maximumAttempts: 5,
  baseDelayMs: 5_000,
  maximumDelayMs: 15 * 60_000,
  jitterRatio: 0.15,
};

export function exponentialBackoffMs(
  attempt: number,
  policy: Partial<CollectorRetryPolicy> = {},
  deterministicJitter = 0,
): number {
  const config = { ...DEFAULT_COLLECTOR_RETRY_POLICY, ...policy };
  const exponent = Math.max(0, attempt - 1);
  const base = Math.min(config.maximumDelayMs, config.baseDelayMs * 2 ** exponent);
  const boundedJitter = Math.max(-1, Math.min(1, deterministicJitter));
  return Math.round(base * (1 + boundedJitter * config.jitterRatio));
}

export function createCollectorJob(
  collector: IntelligenceCollector,
  source: IntelligenceSource,
  scheduledFor: string,
  options: { attempt?: number; cursor?: string; since?: string; maximumAttempts?: number } = {},
): CollectorJob {
  const attempt = options.attempt ?? 1;
  return {
    id: `job-${collector.id}-${source.id}-${Date.parse(scheduledFor) || 0}-${attempt}`,
    collectorId: collector.id,
    sourceId: source.id,
    scheduledFor,
    attempt,
    cursor: options.cursor,
    since: options.since,
    deadLetterAfter: options.maximumAttempts ?? DEFAULT_COLLECTOR_RETRY_POLICY.maximumAttempts,
  };
}

export function nextScheduledCollectionAt(
  source: IntelligenceSource,
  after: string,
): string {
  const afterTime = Date.parse(after);
  if (!Number.isFinite(afterTime)) throw new Error("Scheduling base time must be a valid timestamp.");
  const intervalMinutes = Math.max(1, source.schedule.intervalMinutes);
  return new Date(afterTime + intervalMinutes * 60_000).toISOString();
}

export function earliestRateLimitedRunAt(
  source: IntelligenceSource,
  previousRunStartedAt: string | undefined,
  requestedAt: string,
): string {
  const requestedTime = Date.parse(requestedAt);
  if (!Number.isFinite(requestedTime)) throw new Error("Requested run time must be a valid timestamp.");
  if (!previousRunStartedAt || !source.rateLimitPerMinute) return new Date(requestedTime).toISOString();

  const previousTime = Date.parse(previousRunStartedAt);
  if (!Number.isFinite(previousTime)) return new Date(requestedTime).toISOString();
  const minimumSpacingMs = 60_000 / Math.max(1, source.rateLimitPerMinute);
  return new Date(Math.max(requestedTime, previousTime + minimumSpacingMs)).toISOString();
}

export function createNextScheduledJob(
  collector: IntelligenceCollector,
  source: IntelligenceSource,
  lastScheduledAt: string,
  options: { cursor?: string; lastSuccessfulCollectionAt?: string } = {},
): CollectorJob {
  return createCollectorJob(
    collector,
    source,
    nextScheduledCollectionAt(source, lastScheduledAt),
    {
      cursor: options.cursor,
      since: options.lastSuccessfulCollectionAt ?? source.lastSuccessfulCollectionAt,
    },
  );
}

function shortFingerprint(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

/** Stable pre-insert key; persistence still stores a cryptographic content hash. */
export function collectedReportIdempotencyKey(
  sourceId: string,
  report: CollectedReport,
): string {
  if (report.externalId) return `${sourceId}:external:${normalizeText(report.externalId)}`;
  const canonicalUrl = normalizeUrl(report.url);
  if (canonicalUrl) return `${sourceId}:url:${canonicalUrl}`;
  return `${sourceId}:content:${shortFingerprint(
    normalizeText(`${report.title} ${report.description ?? ""} ${report.bodyText ?? ""}`),
  )}`;
}

/**
 * Executes exactly one queued job. Persistent queues or cron trigger this
 * function; it intentionally creates no in-process interval or detached retry.
 */
export async function executeCollectorJob(
  collector: IntelligenceCollector,
  source: IntelligenceSource,
  job: CollectorJob,
  options: {
    now?: () => Date;
    signal?: AbortSignal;
    retryPolicy?: Partial<CollectorRetryPolicy>;
    deterministicJitter?: number;
  } = {},
): Promise<CollectorExecutionResult> {
  if (job.collectorId !== collector.id || job.sourceId !== source.id) {
    throw new Error("Collector job does not match the supplied collector and source.");
  }

  const now = options.now ?? (() => new Date());
  const startedAtDate = now();
  const startedAt = startedAtDate.toISOString();
  const requestId = `${job.id}-request`;
  const context: CollectorContext = {
    source,
    requestedAt: startedAt,
    since: job.since,
    cursor: job.cursor,
    signal: options.signal,
    requestId,
  };

  try {
    const reports = await collector.collect(context);
    const completedAtDate = now();
    return {
      run: {
        id: `run-${job.id}`,
        collectorId: collector.id,
        sourceId: source.id,
        status: "succeeded",
        startedAt,
        completedAt: completedAtDate.toISOString(),
        reportsSeen: reports.length,
        reportsInserted: 0,
        duplicatesSkipped: 0,
        rejectedCount: 0,
        retryCount: job.attempt - 1,
        durationMs: Math.max(0, completedAtDate.getTime() - startedAtDate.getTime()),
        requestId,
        dataClassification: "demonstration",
      },
      reports,
      deadLettered: false,
    };
  } catch (error) {
    const completedAtDate = now();
    const message = error instanceof Error ? error.message : "Unknown collector error.";
    const policy = { ...DEFAULT_COLLECTOR_RETRY_POLICY, ...options.retryPolicy };
    const deadLettered = job.attempt >= Math.min(job.deadLetterAfter, policy.maximumAttempts);
    const retryDelay = exponentialBackoffMs(
      job.attempt,
      policy,
      options.deterministicJitter ?? 0,
    );
    const retryJob = deadLettered
      ? undefined
      : createCollectorJob(
          collector,
          source,
          new Date(completedAtDate.getTime() + retryDelay).toISOString(),
          {
            attempt: job.attempt + 1,
            cursor: job.cursor,
            since: job.since,
            maximumAttempts: job.deadLetterAfter,
          },
        );

    return {
      run: {
        id: `run-${job.id}`,
        collectorId: collector.id,
        sourceId: source.id,
        status: deadLettered ? "dead-lettered" : "failed",
        startedAt,
        completedAt: completedAtDate.toISOString(),
        reportsSeen: 0,
        reportsInserted: 0,
        duplicatesSkipped: 0,
        rejectedCount: 0,
        retryCount: job.attempt - 1,
        durationMs: Math.max(0, completedAtDate.getTime() - startedAtDate.getTime()),
        errorMessage: message,
        requestId,
        dataClassification: "demonstration",
      },
      reports: [],
      retryJob,
      deadLettered,
    };
  }
}
