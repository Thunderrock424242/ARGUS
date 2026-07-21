import {
  collectorForPilotDefinition,
  collectorPilotDefinitions,
  PUBLIC_INFORMATION_LABEL,
  type CollectorPilotConfiguration,
  type CollectorPilotDefinition,
  type PilotCollectorId,
} from "@/packages/intelligence/collector-sources";
import {
  createCollectorJob,
  executeCollectorJob,
  type CollectorTransport,
} from "@/packages/intelligence";
import { assertPublicHttpUrl } from "@/lib/security/public-url";
import type { CollectorRun, IntelligenceSource } from "@/packages/shared/types";
import {
  prepareReadModelUpsert,
  readModelById,
  READ_MODEL_COLLECTIONS,
  type D1DocumentDatabase,
  type D1PreparedStatementLike,
} from "./d1-read-model-provider";
import { createIngestionSubmission } from "./ingestion-store";

interface CollectorRunRow {
  id: string;
  collector_id: string;
  source_id: string;
  status: CollectorRun["status"];
  mode: "dry-run" | "live";
  scheduled_for: string;
  attempt: number;
  started_at: string;
  completed_at: string | null;
  reports_seen: number;
  reports_inserted: number;
  duplicates_skipped: number;
  rejected_count: number;
  retry_count: number;
  duration_ms: number | null;
  error_message: string | null;
  next_retry_at: string | null;
  network_accessed: number;
  request_id: string;
  data_classification: CollectorRun["dataClassification"];
}

export interface CollectorPilotRunResult {
  run: CollectorRun;
  ingestionSubmissionIds: string[];
}

export interface CollectorPilotStatus {
  enabled: boolean;
  schedule: string;
  sources: Array<{
    collectorId: PilotCollectorId;
    sourceId: string;
    name: string;
    organization: string;
    signalRole: CollectorPilotDefinition["signalRole"];
    requestedEnabled: boolean;
    active: boolean;
    credentialRequired: boolean;
    credentialConfigured: boolean;
    disabledReason?: string;
    intervalMinutes: number;
    limitations: string;
    lastRun: CollectorRun | null;
  }>;
}

function sourceUpsert(
  database: D1DocumentDatabase,
  source: IntelligenceSource,
  now: string,
): D1PreparedStatementLike {
  return database
    .prepare(
      `INSERT INTO intelligence_sources (
        id, name, organization, type, url, country_code, region, categories,
        reliability_score, independence_group, limitations, attribution_requirements,
        status, schedule, rate_limit_per_minute, enabled, last_checked_at,
        last_successful_collection_at, recent_failure_count, reports_collected,
        data_classification, demo_data_label, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        organization = excluded.organization,
        type = excluded.type,
        url = excluded.url,
        categories = excluded.categories,
        reliability_score = excluded.reliability_score,
        independence_group = excluded.independence_group,
        limitations = excluded.limitations,
        attribution_requirements = excluded.attribution_requirements,
        status = excluded.status,
        schedule = excluded.schedule,
        rate_limit_per_minute = excluded.rate_limit_per_minute,
        enabled = excluded.enabled,
        last_checked_at = excluded.last_checked_at,
        last_successful_collection_at = excluded.last_successful_collection_at,
        recent_failure_count = excluded.recent_failure_count,
        reports_collected = excluded.reports_collected,
        data_classification = excluded.data_classification,
        demo_data_label = excluded.demo_data_label,
        updated_at = excluded.updated_at`,
    )
    .bind(
      source.id,
      source.name,
      source.organization,
      source.type,
      source.url,
      source.countryCode ?? null,
      source.region ?? null,
      JSON.stringify(source.categories),
      source.reliabilityScore,
      source.independenceGroup,
      source.limitations,
      source.attributionRequirements,
      source.status,
      JSON.stringify(source.schedule),
      source.rateLimitPerMinute ?? null,
      source.enabled ? 1 : 0,
      source.lastCheckedAt ?? null,
      source.lastSuccessfulCollectionAt ?? null,
      source.recentFailureCount,
      source.reportsCollected,
      source.dataClassification,
      source.demoDataLabel,
      now,
      now,
    );
}

function collectorRunFromRow(row: CollectorRunRow): CollectorRun {
  return {
    id: row.id,
    collectorId: row.collector_id,
    sourceId: row.source_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    reportsSeen: row.reports_seen,
    reportsInserted: row.reports_inserted,
    duplicatesSkipped: row.duplicates_skipped,
    rejectedCount: row.rejected_count,
    retryCount: row.retry_count,
    durationMs: row.duration_ms ?? undefined,
    errorMessage: row.error_message ?? undefined,
    requestId: row.request_id,
    dataClassification: row.data_classification,
    mode: row.mode,
    scheduledFor: row.scheduled_for,
    attempt: row.attempt,
    nextRetryAt: row.next_retry_at ?? undefined,
    networkAccessed: Boolean(row.network_accessed),
  };
}

function collectorRunInsert(
  database: D1DocumentDatabase,
  run: CollectorRun,
): D1PreparedStatementLike {
  return database
    .prepare(
      `INSERT INTO collector_runs (
        id, collector_id, source_id, status, mode, scheduled_for, attempt,
        started_at, completed_at, reports_seen, reports_inserted, duplicates_skipped,
        rejected_count, retry_count, duration_ms, error_message, next_retry_at,
        network_accessed, request_id, data_classification
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      run.id,
      run.collectorId,
      run.sourceId,
      run.status,
      run.mode ?? "live",
      run.scheduledFor ?? run.startedAt,
      run.attempt ?? 1,
      run.startedAt,
      run.completedAt ?? null,
      run.reportsSeen,
      run.reportsInserted,
      run.duplicatesSkipped,
      run.rejectedCount,
      run.retryCount,
      run.durationMs ?? null,
      run.errorMessage ?? null,
      run.nextRetryAt ?? null,
      run.networkAccessed ? 1 : 0,
      run.requestId,
      run.dataClassification,
    );
}

export async function latestCollectorRun(
  database: D1DocumentDatabase,
  collectorId: string,
  sourceId: string,
): Promise<CollectorRun | null> {
  const row = await database
    .prepare(
      `SELECT id, collector_id, source_id, status, mode, scheduled_for, attempt,
        started_at, completed_at, reports_seen, reports_inserted, duplicates_skipped,
        rejected_count, retry_count, duration_ms, error_message, next_retry_at,
        network_accessed, request_id, data_classification
       FROM collector_runs
       WHERE collector_id = ? AND source_id = ?
       ORDER BY started_at DESC LIMIT 1`,
    )
    .bind(collectorId, sourceId)
    .first<CollectorRunRow>();
  return row ? collectorRunFromRow(row) : null;
}

async function prepareSource(
  database: D1DocumentDatabase,
  definition: CollectorPilotDefinition,
): Promise<IntelligenceSource> {
  const now = new Date().toISOString();
  const existing = await readModelById<IntelligenceSource>(
    database,
    READ_MODEL_COLLECTIONS.sources,
    definition.source.id,
  );
  const source = {
    ...definition.source,
    lastCheckedAt: existing?.lastCheckedAt,
    lastSuccessfulCollectionAt: existing?.lastSuccessfulCollectionAt,
    recentFailureCount: existing?.recentFailureCount ?? 0,
    reportsCollected: existing?.reportsCollected ?? 0,
  };
  await database.batch([
    sourceUpsert(database, source, now),
    prepareReadModelUpsert(
      database,
      READ_MODEL_COLLECTIONS.sources,
      { ...source, updatedAt: now },
    ),
  ]);
  return source;
}

export async function runCollectorPilotSource(
  database: D1DocumentDatabase,
  definition: CollectorPilotDefinition,
  transport: CollectorTransport,
  options: { scheduledFor?: string; attempt?: number } = {},
): Promise<CollectorPilotRunResult> {
  if (!definition.active) {
    throw new Error(definition.disabledReason ?? "The collector source is not active.");
  }
  const source = await prepareSource(database, definition);
  const scheduledFor = options.scheduledFor ?? new Date().toISOString();
  const collector = collectorForPilotDefinition(definition, transport);
  const job = createCollectorJob(collector, source, scheduledFor, {
    attempt: options.attempt ?? 1,
  });
  const result = await executeCollectorJob(collector, source, job, {
    dataClassification: "public-information",
    mode: "live",
  });
  const submissionIds: string[] = [];
  let inserted = 0;
  let duplicates = 0;
  let rejected = 0;
  let persistenceError: string | undefined;

  for (const report of result.reports) {
    try {
      assertPublicHttpUrl(report.url, { requireHttps: true });
      const saved = await createIngestionSubmission(
        database,
        {
          sourceId: source.id,
          externalId: report.externalId,
          url: report.url,
          title: report.title,
          description: report.description,
          bodyText: report.bodyText,
          author: report.author,
          language: report.language ?? "en",
          publishedAt: report.publishedAt,
          latitude: report.latitude,
          longitude: report.longitude,
          countryCode: report.countryCode,
          category: source.categories[0],
          attribution: source.attributionRequirements,
          provenanceNotes: `${collector.name}; ${definition.signalRole} signal; automated collection for protected analyst review.`,
        },
        { id: `collector:${collector.id}`, name: collector.name },
        result.run.requestId,
        {
          method: "collector",
          actorType: "collector",
          dataClassification: "public-information",
          dataLabel: PUBLIC_INFORMATION_LABEL,
        },
      );
      submissionIds.push(saved.submission.id);
      if (saved.idempotent || saved.submission.status === "duplicate") duplicates += 1;
      else inserted += 1;
    } catch (error) {
      rejected += 1;
      persistenceError ??= error instanceof Error ? error.message : "The intake record could not be persisted.";
    }
  }

  const run: CollectorRun = {
    ...result.run,
    status: result.run.status === "succeeded" && rejected > 0 ? "partial" : result.run.status,
    reportsInserted: inserted,
    duplicatesSkipped: duplicates,
    rejectedCount: rejected,
    errorMessage: result.run.errorMessage ?? persistenceError,
  };
  const completedAt = run.completedAt ?? new Date().toISOString();
  const collected = run.status === "succeeded" || run.status === "partial";
  const healthy = run.status === "succeeded";
  const updatedSource: IntelligenceSource = {
    ...source,
    status: healthy ? "online" : run.status === "dead-lettered" ? "offline" : "degraded",
    lastCheckedAt: completedAt,
    lastSuccessfulCollectionAt: collected ? completedAt : source.lastSuccessfulCollectionAt,
    recentFailureCount: healthy ? 0 : source.recentFailureCount + 1,
    reportsCollected: source.reportsCollected + inserted,
  };
  await database.batch([
    sourceUpsert(database, updatedSource, completedAt),
    prepareReadModelUpsert(
      database,
      READ_MODEL_COLLECTIONS.sources,
      { ...updatedSource, updatedAt: completedAt },
    ),
    collectorRunInsert(database, run),
  ]);
  return { run, ingestionSubmissionIds: submissionIds };
}

function isDue(definition: CollectorPilotDefinition, lastRun: CollectorRun | null, now: Date): { due: boolean; attempt: number } {
  if (!lastRun) return { due: true, attempt: 1 };
  if (lastRun.status === "failed" && lastRun.nextRetryAt) {
    return {
      due: Date.parse(lastRun.nextRetryAt) <= now.getTime(),
      attempt: (lastRun.attempt ?? 1) + 1,
    };
  }
  const startedAt = Date.parse(lastRun.scheduledFor ?? lastRun.startedAt);
  const dueAt = startedAt + definition.source.schedule.intervalMinutes * 60_000;
  return { due: !Number.isFinite(dueAt) || dueAt <= now.getTime(), attempt: 1 };
}

export async function runScheduledCollectorPilot(
  database: D1DocumentDatabase,
  config: CollectorPilotConfiguration,
  transport: CollectorTransport,
  now = new Date(),
): Promise<CollectorPilotRunResult[]> {
  if (!config.enabled) return [];
  const results: CollectorPilotRunResult[] = [];
  for (const definition of collectorPilotDefinitions(config).filter((candidate) => candidate.active)) {
    const previous = await latestCollectorRun(database, definition.collectorId, definition.source.id);
    const schedule = isDue(definition, previous, now);
    if (!schedule.due) continue;
    results.push(await runCollectorPilotSource(database, definition, transport, {
      scheduledFor: now.toISOString(),
      attempt: schedule.attempt,
    }));
  }
  return results;
}

export async function readCollectorPilotStatus(
  database: D1DocumentDatabase,
  config: CollectorPilotConfiguration,
): Promise<CollectorPilotStatus> {
  const definitions = collectorPilotDefinitions(config);
  return {
    enabled: config.enabled,
    schedule: "Every 15 minutes (UTC); each source still enforces its own interval.",
    sources: await Promise.all(definitions.map(async (definition) => ({
      collectorId: definition.collectorId,
      sourceId: definition.source.id,
      name: definition.source.name,
      organization: definition.source.organization,
      signalRole: definition.signalRole,
      requestedEnabled: definition.requestedEnabled,
      active: definition.active,
      credentialRequired: definition.credentialRequired,
      credentialConfigured: definition.credentialConfigured,
      disabledReason: definition.disabledReason,
      intervalMinutes: definition.source.schedule.intervalMinutes,
      limitations: definition.source.limitations,
      lastRun: await latestCollectorRun(database, definition.collectorId, definition.source.id),
    }))),
  };
}
