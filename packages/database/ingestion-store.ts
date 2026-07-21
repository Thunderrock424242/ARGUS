import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import {
  ingestionContentHash,
  ingestionIdempotencyKey,
  normalizeIngestionIntake,
  type IngestionIntake,
} from "@/packages/intelligence/ingestion";
import {
  PUBLIC_INFORMATION_APPROVED_CONFIDENCE,
  PUBLIC_INFORMATION_INITIAL_CONFIDENCE,
} from "@/packages/intelligence/confidence-policy";
import type {
  AuditLogEntry,
  DemoDataClassification,
  IngestionProvenance,
  IngestionSubmission,
  IngestionSubmissionStatus,
  SourceReport,
} from "@/packages/shared/types";
import {
  READ_MODEL_COLLECTIONS,
  encodedReadModelDocument,
  readModelById,
  type D1DocumentDatabase,
  type D1PreparedStatementLike,
} from "./d1-read-model-provider";

interface IngestionRow {
  id: string;
  source_id: string;
  external_id: string | null;
  idempotency_key: string;
  content_hash: string;
  url: string;
  normalized_url: string;
  title: string;
  description: string | null;
  body_text: string | null;
  author: string | null;
  language: string;
  published_at: string;
  latitude: number | null;
  longitude: number | null;
  country_code: string | null;
  category: IngestionSubmission["category"] | null;
  status: IngestionSubmissionStatus;
  duplicate_of_report_id: string | null;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  submitted_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  reviewed_by_name: string | null;
  review_reason: string | null;
  confidence: number;
  confidence_updated_at: string | null;
  confidence_updated_by_id: string | null;
  confidence_updated_by_name: string | null;
  confidence_update_reason: string | null;
  provenance: string | IngestionProvenance;
  data_classification: IngestionSubmission["dataClassification"];
  demo_data_label: string;
  version: number;
  total_count?: number;
}

interface CanonicalDuplicateRow {
  record_id: string;
}

export class IngestionStoreError extends Error {
  constructor(
    readonly status: 409 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const INGESTION_COLUMNS = `id, source_id, external_id, idempotency_key, content_hash,
  url, normalized_url, title, description, body_text, author, language, published_at,
  latitude, longitude, country_code, category, status, duplicate_of_report_id, attempts,
  last_error, next_retry_at, submitted_at, updated_at, reviewed_at, reviewed_by_id,
  reviewed_by_name, review_reason, confidence, confidence_updated_at,
  confidence_updated_by_id, confidence_updated_by_name, confidence_update_reason,
  provenance, data_classification, demo_data_label, version`;

function decodedProvenance(value: IngestionRow["provenance"]): IngestionProvenance {
  return typeof value === "string" ? JSON.parse(value) as IngestionProvenance : value;
}

function submissionFromRow(row: IngestionRow): IngestionSubmission {
  return {
    id: row.id,
    sourceId: row.source_id,
    externalId: row.external_id ?? undefined,
    idempotencyKey: row.idempotency_key,
    contentHash: row.content_hash,
    url: row.url,
    normalizedUrl: row.normalized_url,
    title: row.title,
    description: row.description ?? undefined,
    bodyText: row.body_text ?? undefined,
    author: row.author ?? undefined,
    language: row.language,
    publishedAt: row.published_at,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    countryCode: row.country_code ?? undefined,
    category: row.category ?? undefined,
    status: row.status,
    duplicateOfReportId: row.duplicate_of_report_id ?? undefined,
    attempts: row.attempts,
    lastError: row.last_error ?? undefined,
    nextRetryAt: row.next_retry_at ?? undefined,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedById: row.reviewed_by_id ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewReason: row.review_reason ?? undefined,
    confidence: row.confidence,
    confidenceUpdatedAt: row.confidence_updated_at ?? undefined,
    confidenceUpdatedById: row.confidence_updated_by_id ?? undefined,
    confidenceUpdatedByName: row.confidence_updated_by_name ?? undefined,
    confidenceUpdateReason: row.confidence_update_reason ?? undefined,
    provenance: decodedProvenance(row.provenance),
    dataClassification: row.data_classification,
    demoDataLabel: row.demo_data_label,
    recordVersion: row.version,
  };
}

export async function readIngestionSubmission(
  database: D1DocumentDatabase,
  id: string,
): Promise<IngestionSubmission | null> {
  const row = await database
    .prepare(`SELECT ${INGESTION_COLUMNS} FROM ingestion_submissions WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<IngestionRow>();
  return row ? submissionFromRow(row) : null;
}

async function readByIdempotencyKey(
  database: D1DocumentDatabase,
  key: string,
): Promise<IngestionSubmission | null> {
  const row = await database
    .prepare(`SELECT ${INGESTION_COLUMNS} FROM ingestion_submissions WHERE idempotency_key = ? LIMIT 1`)
    .bind(key)
    .first<IngestionRow>();
  return row ? submissionFromRow(row) : null;
}

async function readExistingSubmission(
  database: D1DocumentDatabase,
  input: { idempotencyKey: string; sourceId: string; externalId?: string },
): Promise<IngestionSubmission | null> {
  if (!input.externalId) return readByIdempotencyKey(database, input.idempotencyKey);
  const row = await database
    .prepare(
      `SELECT ${INGESTION_COLUMNS} FROM ingestion_submissions
       WHERE idempotency_key = ? OR (source_id = ? AND external_id = ?)
       ORDER BY CASE WHEN idempotency_key = ? THEN 0 ELSE 1 END LIMIT 1`,
    )
    .bind(input.idempotencyKey, input.sourceId, input.externalId, input.idempotencyKey)
    .first<IngestionRow>();
  return row ? submissionFromRow(row) : null;
}

export async function readIngestionPage(
  database: D1DocumentDatabase,
  input: { page: number; limit: number; status?: IngestionSubmissionStatus; sourceId?: string },
): Promise<{ submissions: IngestionSubmission[]; total: number }> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (input.status) {
    clauses.push("status = ?");
    values.push(input.status);
  }
  if (input.sourceId) {
    clauses.push("source_id = ?");
    values.push(input.sourceId);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const offset = (input.page - 1) * input.limit;
  const result = await database
    .prepare(
      `SELECT ${INGESTION_COLUMNS}, COUNT(*) OVER() AS total_count
       FROM ingestion_submissions${where}
       ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...values, input.limit, offset)
    .all<IngestionRow>();
  const rows = result.results ?? [];
  return {
    submissions: rows.map(submissionFromRow),
    total: rows[0]?.total_count ?? 0,
  };
}

function auditInsert(
  database: D1DocumentDatabase,
  input: {
    id: string;
    occurredAt: string;
    actorId: string;
    actorName: string;
    action: "ingestion-submitted" | "ingestion-approved" | "ingestion-rejected" | "ingestion-retried" | "ingestion-confidence-updated";
    targetId: string;
    summary: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    requestId: string;
    requiredVersion: number;
    actorType?: AuditLogEntry["actorType"];
    dataClassification?: DemoDataClassification;
  },
): D1PreparedStatementLike {
  return database
    .prepare(
      `INSERT INTO audit_logs (
        id, occurred_at, actor_type, actor_id, actor_name, action, target_type,
        target_id, summary, before, after, reason, correlation_id, data_classification
      )
      SELECT ?, ?, ?, ?, ?, ?, 'ingestion-submission', ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM ingestion_submissions WHERE id = ? AND version = ?)`,
    )
    .bind(
      input.id,
      input.occurredAt,
      input.actorType ?? "analyst",
      input.actorId,
      input.actorName,
      input.action,
      input.targetId,
      input.summary,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.reason ?? null,
      input.requestId,
      input.dataClassification ?? "demonstration",
      input.targetId,
      input.requiredVersion,
    );
}

export async function createIngestionSubmission(
  database: D1DocumentDatabase,
  intake: IngestionIntake,
  actor: { id: string; name: string },
  requestId: string,
  options: {
    method?: IngestionProvenance["method"];
    actorType?: AuditLogEntry["actorType"];
    dataClassification?: DemoDataClassification;
    dataLabel?: string;
  } = {},
): Promise<{ submission: IngestionSubmission; idempotent: boolean }> {
  const normalized = normalizeIngestionIntake(intake);
  const contentHash = await ingestionContentHash(normalized);
  const idempotencyKey = await ingestionIdempotencyKey(normalized, contentHash);
  const existing = await readExistingSubmission(database, {
    idempotencyKey,
    sourceId: normalized.sourceId,
    externalId: normalized.externalId,
  });
  if (existing) return { submission: existing, idempotent: true };

  const canonicalDuplicate = await database
    .prepare(
      "SELECT record_id FROM intelligence_read_models WHERE collection = 'reports' AND json_extract(document, '$.contentHash') = ? LIMIT 1",
    )
    .bind(contentHash)
    .first<CanonicalDuplicateRow>();
  const status: IngestionSubmissionStatus = canonicalDuplicate ? "duplicate" : "needs-review";
  const id = `ingestion-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const dataClassification = options.dataClassification ?? "demonstration";
  const dataLabel = options.dataLabel ?? DEMONSTRATION_DATA_LABEL;
  const confidence = PUBLIC_INFORMATION_INITIAL_CONFIDENCE;
  const provenance: IngestionProvenance = {
    method: options.method ?? "manual",
    submittedById: actor.id,
    submittedByName: actor.name,
    sourceUrl: normalized.url,
    attribution: normalized.attribution,
    notes: normalized.provenanceNotes,
    requestId,
  };
  const submissionDraft: IngestionSubmission = {
    id,
    sourceId: normalized.sourceId,
    externalId: normalized.externalId,
    idempotencyKey,
    contentHash,
    url: normalized.url,
    normalizedUrl: normalized.normalizedUrl,
    title: normalized.title,
    description: normalized.description,
    bodyText: normalized.bodyText,
    author: normalized.author,
    language: normalized.language,
    publishedAt: normalized.publishedAt,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    countryCode: normalized.countryCode,
    category: normalized.category,
    status,
    duplicateOfReportId: canonicalDuplicate?.record_id,
    attempts: 1,
    submittedAt: now,
    updatedAt: now,
    provenance,
    confidence,
    dataClassification,
    demoDataLabel: dataLabel,
    recordVersion: 1,
  };
  const insert = database
    .prepare(
      `INSERT OR IGNORE INTO ingestion_submissions (
        id, source_id, external_id, idempotency_key, content_hash, url, normalized_url,
        title, description, body_text, author, language, published_at, latitude, longitude,
        country_code, category, status, duplicate_of_report_id, attempts, submitted_at,
        updated_at, confidence, provenance, data_classification, demo_data_label, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(
      id,
      normalized.sourceId,
      normalized.externalId ?? null,
      idempotencyKey,
      contentHash,
      normalized.url,
      normalized.normalizedUrl,
      normalized.title,
      normalized.description ?? null,
      normalized.bodyText ?? null,
      normalized.author ?? null,
      normalized.language,
      normalized.publishedAt,
      normalized.latitude ?? null,
      normalized.longitude ?? null,
      normalized.countryCode ?? null,
      normalized.category ?? null,
      status,
      canonicalDuplicate?.record_id ?? null,
      now,
      now,
      confidence,
      JSON.stringify(provenance),
      dataClassification,
      dataLabel,
    );
  const attempt = database
    .prepare(
      `INSERT INTO ingestion_attempts (
        id, submission_id, attempt, state, started_at, completed_at, request_id
      ) SELECT ?, ?, 1, 'accepted', ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM ingestion_submissions WHERE id = ? AND version = 1)`,
    )
    .bind(`ingestion-attempt-${crypto.randomUUID()}`, id, now, now, requestId, id);
  const audit = auditInsert(database, {
    id: `audit-${crypto.randomUUID()}`,
    occurredAt: now,
    actorId: actor.id,
    actorName: actor.name,
    action: "ingestion-submitted",
    targetId: id,
    summary: `${actor.name} submitted ${normalized.title} to the ingestion review queue.`,
    after: { sourceId: normalized.sourceId, status, contentHash, confidence, duplicateOfReportId: canonicalDuplicate?.record_id },
    requestId,
    requiredVersion: 1,
    actorType: options.actorType,
    dataClassification,
  });
  const statements: D1PreparedStatementLike[] = [insert, attempt];
  if (dataClassification === "public-information" && status === "needs-review") {
    const provisionalReport = canonicalReport(submissionDraft, undefined, {
      processingStatus: "pending",
      verificationState: "needs-review",
      confidence,
    });
    statements.push(
      database
        .prepare(
          `INSERT INTO intelligence_read_models (
            id, collection, record_id, slug, document, version, sort_order, updated_at, data_classification
          ) SELECT ?, 'reports', ?, NULL, ?, 1, 0, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM ingestion_submissions
            WHERE id = ? AND status = 'needs-review' AND version = 1
          )
          ON CONFLICT(collection, record_id) DO NOTHING`,
        )
        .bind(
          `${READ_MODEL_COLLECTIONS.reports}:${provisionalReport.id}`,
          provisionalReport.id,
          encodedReadModelDocument(provisionalReport),
          provisionalReport.collectedAt,
          provisionalReport.dataClassification,
          id,
        ),
    );
  }
  statements.push(audit);
  const results = await database.batch(statements);
  if ((results[0]?.meta?.changes ?? 0) === 0) {
    const raced = await readExistingSubmission(database, {
      idempotencyKey,
      sourceId: normalized.sourceId,
      externalId: normalized.externalId,
    });
    if (raced) return { submission: raced, idempotent: true };
    throw new IngestionStoreError(503, "ingestion_store_unavailable", "The intake record could not be persisted.");
  }
  const created = await readIngestionSubmission(database, id);
  if (!created) throw new IngestionStoreError(503, "ingestion_store_unavailable", "The persisted intake record could not be loaded.");
  return { submission: created, idempotent: false };
}

function canonicalReport(
  submission: IngestionSubmission,
  eventId?: string,
  options: {
    processingStatus?: SourceReport["processingStatus"];
    verificationState?: SourceReport["verificationState"];
    confidence?: number;
  } = {},
): SourceReport {
  return {
    id: `report-${submission.id}`,
    sourceId: submission.sourceId,
    eventId,
    externalId: submission.externalId,
    url: submission.url,
    normalizedUrl: submission.normalizedUrl,
    title: submission.title,
    description: submission.description,
    bodyText: submission.bodyText,
    author: submission.author,
    language: submission.language,
    publishedAt: submission.publishedAt,
    collectedAt: submission.submittedAt,
    latitude: submission.latitude,
    longitude: submission.longitude,
    countryCode: submission.countryCode,
    category: submission.category,
    rawPayload: { ingestionSubmissionId: submission.id, provenance: submission.provenance },
    contentHash: submission.contentHash,
    processingStatus: options.processingStatus ?? "processed",
    confidence: options.confidence ?? submission.confidence,
    verificationState: options.verificationState ?? "needs-review",
    confidenceUpdatedAt: submission.confidenceUpdatedAt,
    confidenceUpdatedById: submission.confidenceUpdatedById,
    confidenceUpdatedByName: submission.confidenceUpdatedByName,
    confidenceUpdateReason: submission.confidenceUpdateReason,
    dataClassification: submission.dataClassification,
    demoDataLabel: submission.demoDataLabel,
  };
}

export async function reviewIngestionSubmission(
  database: D1DocumentDatabase,
  input: {
    id: string;
    decision: "approve" | "reject";
    reason: string;
    expectedVersion: number;
    eventId?: string;
    confidenceOverride?: number;
    actor: { id: string; name: string };
    requestId: string;
  },
): Promise<{ submission: IngestionSubmission; report?: SourceReport }> {
  const current = await readIngestionSubmission(database, input.id);
  if (!current) throw new IngestionStoreError(409, "ingestion_not_found", "The ingestion submission does not exist.");
  if (current.recordVersion !== input.expectedVersion) {
    throw new IngestionStoreError(409, "stale_version", "The ingestion submission changed before this decision was saved.");
  }
  if (current.status !== "needs-review") {
    throw new IngestionStoreError(409, "ingestion_state_conflict", `A ${current.status} submission cannot be reviewed again.`);
  }

  const now = new Date().toISOString();
  const nextVersion = current.recordVersion + 1;
  const nextStatus: IngestionSubmissionStatus = input.decision === "approve" ? "approved" : "rejected";
  const nextConfidence = input.decision === "approve"
    ? input.confidenceOverride ?? Math.max(current.confidence, PUBLIC_INFORMATION_APPROVED_CONFIDENCE)
    : current.confidence;
  const update = database
    .prepare(
      `UPDATE ingestion_submissions SET status = ?, updated_at = ?, reviewed_at = ?,
        reviewed_by_id = ?, reviewed_by_name = ?, review_reason = ?, confidence = ?,
        confidence_updated_at = ?, confidence_updated_by_id = ?, confidence_updated_by_name = ?,
        confidence_update_reason = ?, version = version + 1
       WHERE id = ? AND version = ? AND status = 'needs-review'`,
    )
    .bind(
      nextStatus,
      now,
      now,
      input.actor.id,
      input.actor.name,
      input.reason,
      nextConfidence,
      input.decision === "approve" ? now : current.confidenceUpdatedAt ?? null,
      input.decision === "approve" ? input.actor.id : current.confidenceUpdatedById ?? null,
      input.decision === "approve" ? input.actor.name : current.confidenceUpdatedByName ?? null,
      input.decision === "approve" ? input.reason : current.confidenceUpdateReason ?? null,
      input.id,
      input.expectedVersion,
    );
  const statements: D1PreparedStatementLike[] = [update];
  let report: SourceReport | undefined;
  if (input.decision === "approve") {
    const approvedSubmission: IngestionSubmission = {
      ...current,
      status: "approved",
      confidence: nextConfidence,
      confidenceUpdatedAt: now,
      confidenceUpdatedById: input.actor.id,
      confidenceUpdatedByName: input.actor.name,
      confidenceUpdateReason: input.reason,
      reviewedAt: now,
      reviewedById: input.actor.id,
      reviewedByName: input.actor.name,
      reviewReason: input.reason,
      updatedAt: now,
      recordVersion: nextVersion,
    };
    report = canonicalReport(approvedSubmission, input.eventId, {
      processingStatus: "processed",
      verificationState: "analyst-confirmed",
      confidence: nextConfidence,
    });
    statements.push(
      database
        .prepare(
          `INSERT INTO intelligence_read_models (
            id, collection, record_id, slug, document, version, sort_order, updated_at, data_classification
          ) SELECT ?, 'reports', ?, NULL, ?, 1, 0, ?, ?
          WHERE EXISTS (SELECT 1 FROM ingestion_submissions WHERE id = ? AND status = 'approved' AND version = ?)
          ON CONFLICT(collection, record_id) DO UPDATE SET
            document = excluded.document,
            version = intelligence_read_models.version + 1,
            updated_at = excluded.updated_at,
            data_classification = excluded.data_classification`,
        )
        .bind(
          `${READ_MODEL_COLLECTIONS.reports}:${report.id}`,
          report.id,
          encodedReadModelDocument(report),
          report.collectedAt,
          report.dataClassification,
          input.id,
          nextVersion,
        ),
    );
  } else if (current.dataClassification === "public-information") {
    statements.push(
      database
        .prepare(
          `DELETE FROM intelligence_read_models
           WHERE collection = 'reports' AND record_id = ?
             AND EXISTS (
               SELECT 1 FROM ingestion_submissions
               WHERE id = ? AND status = 'rejected' AND version = ?
             )`,
        )
        .bind(`report-${current.id}`, input.id, nextVersion),
    );
  }
  statements.push(
    auditInsert(database, {
      id: `audit-${crypto.randomUUID()}`,
      occurredAt: now,
      actorId: input.actor.id,
      actorName: input.actor.name,
      action: input.decision === "approve" ? "ingestion-approved" : "ingestion-rejected",
      targetId: input.id,
      summary: `${input.actor.name} ${input.decision === "approve" ? "approved" : "rejected"} ${current.title}.`,
      before: { status: current.status, confidence: current.confidence, version: current.recordVersion },
      after: { status: nextStatus, confidence: nextConfidence, version: nextVersion, reportId: report?.id, eventId: input.eventId },
      reason: input.reason,
      requestId: input.requestId,
      requiredVersion: nextVersion,
      dataClassification: current.dataClassification,
    }),
  );
  const results = await database.batch(statements);
  if ((results[0]?.meta?.changes ?? 0) === 0) {
    throw new IngestionStoreError(409, "stale_version", "The ingestion submission changed before this decision was saved.");
  }
  const saved = await readIngestionSubmission(database, input.id);
  if (!saved) throw new IngestionStoreError(503, "ingestion_store_unavailable", "The reviewed submission could not be loaded.");
  return { submission: saved, report };
}

export async function adjustIngestionConfidence(
  database: D1DocumentDatabase,
  input: {
    id: string;
    confidence: number;
    reason: string;
    expectedVersion: number;
    actor: { id: string; name: string };
    requestId: string;
  },
): Promise<{ submission: IngestionSubmission; report: SourceReport }> {
  const current = await readIngestionSubmission(database, input.id);
  if (!current) throw new IngestionStoreError(409, "ingestion_not_found", "The ingestion submission does not exist.");
  if (current.recordVersion !== input.expectedVersion) {
    throw new IngestionStoreError(409, "stale_version", "The ingestion submission changed before this confidence adjustment was saved.");
  }
  if (current.dataClassification !== "public-information") {
    throw new IngestionStoreError(409, "confidence_policy_conflict", "Only public-information ingestion records use this confidence policy.");
  }
  if (current.status !== "needs-review" && current.status !== "approved") {
    throw new IngestionStoreError(409, "ingestion_state_conflict", `A ${current.status} submission cannot receive a confidence adjustment.`);
  }
  if (!Number.isInteger(input.confidence) || input.confidence < 0 || input.confidence > 99) {
    throw new IngestionStoreError(409, "invalid_confidence", "Confidence must be a whole number from 0 through 99.");
  }

  const existingReport = await readModelById<SourceReport>(
    database,
    READ_MODEL_COLLECTIONS.reports,
    `report-${current.id}`,
  );
  if (!existingReport) {
    throw new IngestionStoreError(503, "report_unavailable", "The public report confidence record is unavailable.");
  }

  const now = new Date().toISOString();
  const nextVersion = current.recordVersion + 1;
  const updatedReport: SourceReport = {
    ...existingReport,
    confidence: input.confidence,
    verificationState: current.status === "approved" ? "analyst-confirmed" : "needs-review",
    confidenceUpdatedAt: now,
    confidenceUpdatedById: input.actor.id,
    confidenceUpdatedByName: input.actor.name,
    confidenceUpdateReason: input.reason,
  };
  const update = database
    .prepare(
      `UPDATE ingestion_submissions SET confidence = ?, confidence_updated_at = ?,
        confidence_updated_by_id = ?, confidence_updated_by_name = ?, confidence_update_reason = ?,
        updated_at = ?, version = version + 1
       WHERE id = ? AND version = ? AND status IN ('needs-review', 'approved')`,
    )
    .bind(
      input.confidence,
      now,
      input.actor.id,
      input.actor.name,
      input.reason,
      now,
      input.id,
      input.expectedVersion,
    );
  const reportUpdate = database
    .prepare(
      `INSERT INTO intelligence_read_models (
        id, collection, record_id, slug, document, version, sort_order, updated_at, data_classification
      ) SELECT ?, 'reports', ?, NULL, ?, 1, 0, ?, ?
      WHERE EXISTS (SELECT 1 FROM ingestion_submissions WHERE id = ? AND version = ?)
      ON CONFLICT(collection, record_id) DO UPDATE SET
        document = excluded.document,
        version = intelligence_read_models.version + 1,
        updated_at = excluded.updated_at,
        data_classification = excluded.data_classification`
    )
    .bind(
      `${READ_MODEL_COLLECTIONS.reports}:${updatedReport.id}`,
      updatedReport.id,
      encodedReadModelDocument(updatedReport),
      now,
      updatedReport.dataClassification,
      input.id,
      nextVersion,
    );
  const audit = auditInsert(database, {
    id: `audit-${crypto.randomUUID()}`,
    occurredAt: now,
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "ingestion-confidence-updated",
    targetId: input.id,
    summary: `${input.actor.name} changed the confidence ceiling for ${current.title} from ${current.confidence}% to ${input.confidence}%.`,
    before: { confidence: current.confidence, status: current.status, version: current.recordVersion },
    after: { confidence: input.confidence, status: current.status, version: nextVersion, reportId: updatedReport.id },
    reason: input.reason,
    requestId: input.requestId,
    requiredVersion: nextVersion,
    dataClassification: current.dataClassification,
  });
  const results = await database.batch([update, reportUpdate, audit]);
  if ((results[0]?.meta?.changes ?? 0) === 0) {
    throw new IngestionStoreError(409, "stale_version", "The ingestion submission changed before this confidence adjustment was saved.");
  }
  const saved = await readIngestionSubmission(database, input.id);
  if (!saved) throw new IngestionStoreError(503, "ingestion_store_unavailable", "The adjusted ingestion submission could not be loaded.");
  return { submission: saved, report: updatedReport };
}

export async function retryIngestionSubmission(
  database: D1DocumentDatabase,
  input: {
    id: string;
    reason: string;
    expectedVersion: number;
    actor: { id: string; name: string };
    requestId: string;
  },
): Promise<IngestionSubmission> {
  const current = await readIngestionSubmission(database, input.id);
  if (!current) throw new IngestionStoreError(409, "ingestion_not_found", "The ingestion submission does not exist.");
  if (current.recordVersion !== input.expectedVersion) {
    throw new IngestionStoreError(409, "stale_version", "The ingestion submission changed before the retry was saved.");
  }
  if (current.status !== "failed") {
    throw new IngestionStoreError(409, "ingestion_state_conflict", "Only failed submissions can be retried.");
  }
  const now = new Date().toISOString();
  const nextVersion = current.recordVersion + 1;
  const nextAttempt = current.attempts + 1;
  const update = database
    .prepare(
      `UPDATE ingestion_submissions SET status = 'needs-review', attempts = attempts + 1,
        last_error = NULL, next_retry_at = NULL, updated_at = ?, version = version + 1
       WHERE id = ? AND version = ? AND status = 'failed'`,
    )
    .bind(now, input.id, input.expectedVersion);
  const attempt = database
    .prepare(
      `INSERT INTO ingestion_attempts (
        id, submission_id, attempt, state, started_at, completed_at, request_id
      ) SELECT ?, ?, ?, 'retried', ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM ingestion_submissions WHERE id = ? AND version = ?)`,
    )
    .bind(`ingestion-attempt-${crypto.randomUUID()}`, input.id, nextAttempt, now, now, input.requestId, input.id, nextVersion);
  const audit = auditInsert(database, {
    id: `audit-${crypto.randomUUID()}`,
    occurredAt: now,
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "ingestion-retried",
    targetId: input.id,
    summary: `${input.actor.name} returned ${current.title} to the ingestion review queue.`,
    before: { status: current.status, attempts: current.attempts },
    after: { status: "needs-review", attempts: nextAttempt },
    reason: input.reason,
    requestId: input.requestId,
    requiredVersion: nextVersion,
  });
  const results = await database.batch([update, attempt, audit]);
  if ((results[0]?.meta?.changes ?? 0) === 0) {
    throw new IngestionStoreError(409, "stale_version", "The ingestion submission changed before the retry was saved.");
  }
  const saved = await readIngestionSubmission(database, input.id);
  if (!saved) throw new IngestionStoreError(503, "ingestion_store_unavailable", "The retried submission could not be loaded.");
  return saved;
}
