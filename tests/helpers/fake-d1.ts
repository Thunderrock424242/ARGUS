import type {
  D1DocumentDatabase,
  D1MutationResultLike,
  D1PreparedStatementLike,
} from "@/packages/database/d1-read-model-provider";

interface StoredReadModel {
  id: string;
  collection: string;
  recordId: string;
  slug: string | null;
  document: string;
  version: number;
  sortOrder: number;
  updatedAt: string;
  dataClassification: string;
}

interface StoredAuthUser {
  id: string;
  provider: "github";
  providerSubject: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
  lastAuthenticatedAt: string;
}

interface StoredAuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
}

interface StoredIngestionSubmission {
  id: string;
  sourceId: string;
  externalId: string | null;
  idempotencyKey: string;
  contentHash: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string | null;
  bodyText: string | null;
  author: string | null;
  language: string;
  publishedAt: string;
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
  category: string | null;
  status: string;
  duplicateOfReportId: string | null;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  submittedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewReason: string | null;
  confidence: number;
  confidenceUpdatedAt: string | null;
  confidenceUpdatedById: string | null;
  confidenceUpdatedByName: string | null;
  confidenceUpdateReason: string | null;
  provenance: string;
  dataClassification: string;
  demoDataLabel: string;
  version: number;
}

interface StoredCollectorRun {
  id: string;
  collector_id: string;
  source_id: string;
  status: string;
  mode: string;
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
  data_classification: string;
}

function ingestionRow(row: StoredIngestionSubmission, totalCount?: number): Record<string, unknown> {
  return {
    id: row.id,
    source_id: row.sourceId,
    external_id: row.externalId,
    idempotency_key: row.idempotencyKey,
    content_hash: row.contentHash,
    url: row.url,
    normalized_url: row.normalizedUrl,
    title: row.title,
    description: row.description,
    body_text: row.bodyText,
    author: row.author,
    language: row.language,
    published_at: row.publishedAt,
    latitude: row.latitude,
    longitude: row.longitude,
    country_code: row.countryCode,
    category: row.category,
    status: row.status,
    duplicate_of_report_id: row.duplicateOfReportId,
    attempts: row.attempts,
    last_error: row.lastError,
    next_retry_at: row.nextRetryAt,
    submitted_at: row.submittedAt,
    updated_at: row.updatedAt,
    reviewed_at: row.reviewedAt,
    reviewed_by_id: row.reviewedById,
    reviewed_by_name: row.reviewedByName,
    review_reason: row.reviewReason,
    confidence: row.confidence,
    confidence_updated_at: row.confidenceUpdatedAt,
    confidence_updated_by_id: row.confidenceUpdatedById,
    confidence_updated_by_name: row.confidenceUpdatedByName,
    confidence_update_reason: row.confidenceUpdateReason,
    provenance: row.provenance,
    data_classification: row.dataClassification,
    demo_data_label: row.demoDataLabel,
    version: row.version,
    ...(totalCount === undefined ? {} : { total_count: totalCount }),
  };
}

class FakeD1Statement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(
    private readonly database: FakeD1Database,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async all<T>(): Promise<{ results?: T[] }> {
    const normalized = this.query.toLocaleLowerCase("en-US");
    if (normalized.includes("from ingestion_submissions")) {
      let valueIndex = 0;
      const status = normalized.includes("status = ?") ? String(this.values[valueIndex++]) : undefined;
      const sourceId = normalized.includes("source_id = ?") ? String(this.values[valueIndex++]) : undefined;
      const limit = Number(this.values[valueIndex++]);
      const offset = Number(this.values[valueIndex]);
      const filtered = [...this.database.ingestionSubmissions.values()]
        .filter((row) => !status || row.status === status)
        .filter((row) => !sourceId || row.sourceId === sourceId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
      return {
        results: filtered.slice(offset, offset + limit).map((row) => ingestionRow(row, filtered.length)) as T[],
      };
    }
    if (normalized.includes("from audit_logs")) {
      const filtered = normalized.includes("where target_id = ?")
        ? this.database.auditRows.filter((row) => row[7] === this.values[0])
        : [...this.database.auditRows];
      const limitIndex = normalized.includes("where target_id = ?") ? 1 : 0;
      const limit = Number(this.values[limitIndex]);
      const offset = Number(this.values[limitIndex + 1]);
      const rows = filtered
        .sort((left, right) => String(right[1]).localeCompare(String(left[1])) || String(right[0]).localeCompare(String(left[0])))
        .slice(offset, offset + limit)
        .map((row) => ({
          id: row[0], occurred_at: row[1], actor_type: row[2], actor_id: row[3], actor_name: row[4], action: row[5],
          target_type: row[6], target_id: row[7], summary: row[8], before: row[9], after: row[10], reason: row[11],
          correlation_id: row[12], data_classification: row[13],
        })) as T[];
      return { results: rows };
    }
    if (normalized.includes("from intelligence_read_models") && normalized.includes("collection = ?")) {
      const [collection] = this.values as [string];
      const rows = [...this.database.readModels.values()]
        .filter((row) => row.collection === collection)
        .sort((left, right) => left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt) || left.recordId.localeCompare(right.recordId))
        .map((row) => ({ document: row.document, version: row.version })) as T[];
      return { results: rows };
    }
    if (normalized.includes("from auth_users u")) {
      const rows = [...this.database.authUsers.values()]
        .sort((left, right) => left.login.localeCompare(right.login))
        .map((user) => ({
          id: user.id,
          provider: user.provider,
          provider_subject: user.providerSubject,
          login: user.login,
          display_name: user.displayName,
          avatar_url: user.avatarUrl,
          status: user.status,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
          last_authenticated_at: user.lastAuthenticatedAt,
          roles: [...(this.database.authRoles.get(user.id) ?? [])].join(",") || null,
        })) as T[];
      return { results: rows };
    }
    return { results: [] };
  }

  async first<T>(): Promise<T | null> {
    const normalized = this.query.toLocaleLowerCase("en-US");
    if (normalized.includes("from collector_runs")) {
      const [collectorId, sourceId] = this.values as [string, string];
      const row = this.database.collectorRuns
        .filter((candidate) => candidate.collector_id === collectorId && candidate.source_id === sourceId)
        .sort((left, right) => right.started_at.localeCompare(left.started_at))[0];
      return row ? structuredClone(row) as T : null;
    }
    if (normalized.includes("from ingestion_submissions")) {
      const identifier = String(this.values[0]);
      const row = normalized.includes("idempotency_key = ?")
        ? [...this.database.ingestionSubmissions.values()].find((candidate) =>
            candidate.idempotencyKey === identifier || (
              normalized.includes("source_id = ?") &&
              candidate.sourceId === String(this.values[1]) &&
              candidate.externalId === String(this.values[2])
            ),
          )
        : this.database.ingestionSubmissions.get(identifier);
      return row ? ingestionRow(row) as T : null;
    }
    if (normalized.includes("json_extract(document, '$.contenthash')")) {
      const contentHash = String(this.values[0]);
      const row = [...this.database.readModels.values()].find((candidate) => {
        if (candidate.collection !== "reports") return false;
        return (JSON.parse(candidate.document) as { contentHash?: string }).contentHash === contentHash;
      });
      return row ? ({ record_id: row.recordId } as T) : null;
    }
    if (normalized.startsWith("insert into auth_rate_limits")) {
      const [keyHash, windowStartedAt, expiresAt] = this.values as [string, number, number];
      const key = `${keyHash}:${windowStartedAt}`;
      const count = (this.database.rateLimits.get(key)?.count ?? 0) + 1;
      this.database.rateLimits.set(key, { count, expiresAt });
      return { count } as T;
    }
    if (normalized.includes("from auth_sessions s")) {
      const [tokenHash, now] = this.values as [string, string];
      const session = this.database.authSessions.get(tokenHash);
      if (!session || session.revokedAt || session.expiresAt <= now) return null;
      const user = this.database.authUsers.get(session.userId);
      if (!user || user.status !== "active") return null;
      return {
        id: user.id,
        provider: user.provider,
        provider_subject: user.providerSubject,
        login: user.login,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
        status: user.status,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        last_authenticated_at: user.lastAuthenticatedAt,
        session_expires_at: session.expiresAt,
        roles: [...(this.database.authRoles.get(user.id) ?? [])].join(",") || null,
      } as T;
    }
    if (!normalized.includes("from intelligence_read_models")) return null;
    const [collection, identifier] = this.values as [string, string];
    const row = [...this.database.readModels.values()].find((candidate) =>
      candidate.collection === collection &&
      (normalized.includes("record_id = ?")
        ? candidate.recordId === identifier
        : candidate.slug === identifier),
    );
    return row ? ({ document: row.document, version: row.version } as T) : null;
  }

  async run(): Promise<D1MutationResultLike> {
    const normalized = this.query.trim().toLocaleLowerCase("en-US");
    if (normalized.startsWith("insert or ignore into ingestion_submissions")) {
      const [id, sourceId, externalId, idempotencyKey, contentHash, url, normalizedUrl, title, description, bodyText, author, language, publishedAt, latitude, longitude, countryCode, category, status, duplicateOfReportId, submittedAt, updatedAt, confidence, provenance, dataClassification, demoDataLabel] = this.values as [string, string, string | null, string, string, string, string, string, string | null, string | null, string | null, string, string, number | null, number | null, string | null, string | null, string, string | null, string, string, number, string, string, string];
      const conflict = [...this.database.ingestionSubmissions.values()].find((row) =>
        row.idempotencyKey === idempotencyKey || Boolean(externalId && row.sourceId === sourceId && row.externalId === externalId),
      );
      if (conflict) return { meta: { changes: 0 } };
      this.database.ingestionSubmissions.set(id, {
        id, sourceId, externalId, idempotencyKey, contentHash, url, normalizedUrl, title,
        description, bodyText, author, language, publishedAt, latitude, longitude, countryCode,
        category, status, duplicateOfReportId, attempts: 1, lastError: null, nextRetryAt: null,
        submittedAt, updatedAt, reviewedAt: null, reviewedById: null, reviewedByName: null,
        reviewReason: null, confidence, confidenceUpdatedAt: null, confidenceUpdatedById: null,
        confidenceUpdatedByName: null, confidenceUpdateReason: null, provenance,
        dataClassification, demoDataLabel, version: 1,
      });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into ingestion_attempts")) {
      const [id, submissionId, attempt, stateOrStartedAt, startedOrCompletedAt, completedOrRequestId, maybeRequestId, dependencyId, dependencyVersion] = this.values;
      const hasExplicitAttempt = typeof attempt === "number";
      const actualAttempt = hasExplicitAttempt ? Number(attempt) : 1;
      const actualState = hasExplicitAttempt ? "retried" : "accepted";
      const actualStartedAt = String(hasExplicitAttempt ? stateOrStartedAt : attempt);
      const actualCompletedAt = String(hasExplicitAttempt ? startedOrCompletedAt : stateOrStartedAt);
      const actualRequestId = String(hasExplicitAttempt ? completedOrRequestId : startedOrCompletedAt);
      const actualDependencyId = String(hasExplicitAttempt ? maybeRequestId : completedOrRequestId);
      const actualDependencyVersion = hasExplicitAttempt ? Number(dependencyId) : 1;
      const submission = this.database.ingestionSubmissions.get(actualDependencyId);
      if (!submission || submission.version !== actualDependencyVersion) return { meta: { changes: 0 } };
      this.database.ingestionAttempts.push({ id: String(id), submissionId: String(submissionId), attempt: actualAttempt, state: actualState, startedAt: actualStartedAt, completedAt: actualCompletedAt, requestId: actualRequestId });
      void dependencyVersion;
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("update ingestion_submissions set status = ?")) {
      const [status, updatedAt, reviewedAt, reviewedById, reviewedByName, reviewReason, confidence, confidenceUpdatedAt, confidenceUpdatedById, confidenceUpdatedByName, confidenceUpdateReason, id, expectedVersion] = this.values as [string, string, string, string, string, string, number, string | null, string | null, string | null, string | null, string, number];
      const row = this.database.ingestionSubmissions.get(id);
      if (!row || row.version !== expectedVersion || row.status !== "needs-review") return { meta: { changes: 0 } };
      Object.assign(row, { status, updatedAt, reviewedAt, reviewedById, reviewedByName, reviewReason, confidence, confidenceUpdatedAt, confidenceUpdatedById, confidenceUpdatedByName, confidenceUpdateReason, version: row.version + 1 });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("update ingestion_submissions set confidence = ?")) {
      const [confidence, confidenceUpdatedAt, confidenceUpdatedById, confidenceUpdatedByName, confidenceUpdateReason, updatedAt, id, expectedVersion] = this.values as [number, string, string, string, string, string, string, number];
      const row = this.database.ingestionSubmissions.get(id);
      if (!row || row.version !== expectedVersion || !["needs-review", "approved"].includes(row.status)) return { meta: { changes: 0 } };
      Object.assign(row, { confidence, confidenceUpdatedAt, confidenceUpdatedById, confidenceUpdatedByName, confidenceUpdateReason, updatedAt, version: row.version + 1 });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("update ingestion_submissions set status = 'needs-review'")) {
      const [updatedAt, id, expectedVersion] = this.values as [string, string, number];
      const row = this.database.ingestionSubmissions.get(id);
      if (!row || row.version !== expectedVersion || row.status !== "failed") return { meta: { changes: 0 } };
      Object.assign(row, { status: "needs-review", attempts: row.attempts + 1, lastError: null, nextRetryAt: null, updatedAt, version: row.version + 1 });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into intelligence_read_models") && normalized.includes("from ingestion_submissions")) {
      const [id, recordId, document, updatedAt, dataClassification, submissionId, requiredVersion] = this.values as [string, string, string, string, string, string, number];
      const dependency = this.database.ingestionSubmissions.get(submissionId);
      const expectedVersion = requiredVersion ?? 1;
      const statusMatches = normalized.includes("status = 'approved'")
        ? dependency?.status === "approved"
        : normalized.includes("status = 'needs-review'")
          ? dependency?.status === "needs-review"
          : true;
      if (!dependency || !statusMatches || dependency.version !== expectedVersion) return { meta: { changes: 0 } };
      const key = `reports:${recordId}`;
      const existing = this.database.readModels.get(key);
      if (existing && normalized.includes("do nothing")) return { meta: { changes: 0 } };
      this.database.readModels.set(key, { id, collection: "reports", recordId, slug: null, document, version: existing ? existing.version + 1 : 1, sortOrder: 0, updatedAt, dataClassification });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("delete from intelligence_read_models") && normalized.includes("from ingestion_submissions")) {
      const [recordId, submissionId, requiredVersion] = this.values as [string, string, number];
      const dependency = this.database.ingestionSubmissions.get(submissionId);
      if (!dependency || dependency.status !== "rejected" || dependency.version !== requiredVersion) return { meta: { changes: 0 } };
      return { meta: { changes: this.database.readModels.delete(`reports:${recordId}`) ? 1 : 0 } };
    }
    if (normalized.startsWith("insert into intelligence_read_models") && normalized.includes("where ? = 0 or exists")) {
      const [id, collection, recordId, slug, document, sortOrder, updatedAt, dataClassification, expectedVersion, dependencyCollection, dependencyRecordId, dependencyVersion, updateExpectedVersion] = this.values as [string, string, string, string | null, string, number, string, string, number, string, string, number, number];
      const key = `${collection}:${recordId}`;
      const existing = this.database.readModels.get(key);
      const dependency = this.database.readModels.get(`${dependencyCollection}:${dependencyRecordId}`);
      if (expectedVersion !== 0 && dependency?.version !== dependencyVersion) return { meta: { changes: 0 } };
      if (existing && existing.version !== updateExpectedVersion) return { meta: { changes: 0 } };
      this.database.readModels.set(key, {
        id,
        collection,
        recordId,
        slug,
        document,
        version: existing ? existing.version + 1 : 1,
        sortOrder,
        updatedAt,
        dataClassification,
      });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into intelligence_read_models") && normalized.includes("where exists")) {
      const [id, collection, recordId, slug, document, sortOrder, updatedAt, dataClassification, dependencyCollection, dependencyRecordId, dependencyVersion, dependencyDocument] = this.values as [string, string, string, string | null, string, number, string, string, string, string, number, string];
      const dependency = this.database.readModels.get(`${dependencyCollection}:${dependencyRecordId}`);
      if (dependency?.version !== dependencyVersion || dependency.document !== dependencyDocument) return { meta: { changes: 0 } };
      const key = `${collection}:${recordId}`;
      const existing = this.database.readModels.get(key);
      this.database.readModels.set(key, {
        id,
        collection,
        recordId,
        slug,
        document,
        version: existing ? existing.version + 1 : 1,
        sortOrder,
        updatedAt,
        dataClassification,
      });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into intelligence_read_models")) {
      const [id, collection, recordId, slug, document, version, sortOrder, updatedAt, dataClassification] = this.values as [string, string, string, string | null, string, number, number, string, string];
      const key = `${collection}:${recordId}`;
      const existing = this.database.readModels.get(key);
      this.database.readModels.set(key, {
        id,
        collection,
        recordId,
        slug,
        document,
        version: existing ? Math.max(existing.version + 1, version) : version,
        sortOrder: existing?.sortOrder ?? sortOrder,
        updatedAt,
        dataClassification,
      });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into audit_logs")) {
      if (normalized.includes("where exists")) {
        if (normalized.includes("from ingestion_submissions")) {
          const dependencyId = String(this.values.at(-2));
          const dependencyVersion = Number(this.values.at(-1));
          const dependency = this.database.ingestionSubmissions.get(dependencyId);
          if (dependency?.version !== dependencyVersion) return { meta: { changes: 0 } };
          this.database.auditRows.push([
            this.values[0], this.values[1], this.values[2], this.values[3], this.values[4], this.values[5],
            "ingestion-submission", this.values[6], this.values[7], this.values[8], this.values[9],
            this.values[10], this.values[11], this.values[12],
          ]);
          return { meta: { changes: 1 } };
        }
        const [dependencyCollection, dependencyRecordId, dependencyVersion, dependencyDocument] = this.values.slice(14) as [string, string, number, string];
        const dependency = this.database.readModels.get(`${dependencyCollection}:${dependencyRecordId}`);
        if (dependency?.version !== dependencyVersion || dependency.document !== dependencyDocument) return { meta: { changes: 0 } };
      }
      this.database.auditRows.push(this.values.slice(0, 14));
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into collector_runs")) {
      const [id, collectorId, sourceId, status, mode, scheduledFor, attempt, startedAt, completedAt, reportsSeen, reportsInserted, duplicatesSkipped, rejectedCount, retryCount, durationMs, errorMessage, nextRetryAt, networkAccessed, requestId, dataClassification] = this.values;
      this.database.collectorRuns.push({
        id: String(id), collector_id: String(collectorId), source_id: String(sourceId), status: String(status),
        mode: String(mode), scheduled_for: String(scheduledFor), attempt: Number(attempt), started_at: String(startedAt),
        completed_at: completedAt === null ? null : String(completedAt), reports_seen: Number(reportsSeen),
        reports_inserted: Number(reportsInserted), duplicates_skipped: Number(duplicatesSkipped), rejected_count: Number(rejectedCount),
        retry_count: Number(retryCount), duration_ms: durationMs === null ? null : Number(durationMs),
        error_message: errorMessage === null ? null : String(errorMessage), next_retry_at: nextRetryAt === null ? null : String(nextRetryAt),
        network_accessed: Number(networkAccessed), request_id: String(requestId), data_classification: String(dataClassification),
      });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into intelligence_sources")) {
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into auth_users")) {
      const [id, providerSubject, login, displayName, avatarUrl, createdAt, updatedAt, lastAuthenticatedAt] = this.values as [string, string, string, string, string | null, string, string, string];
      const existing = [...this.database.authUsers.values()].find((user) => user.providerSubject === providerSubject);
      this.database.authUsers.set(existing?.id ?? id, {
        id: existing?.id ?? id,
        provider: "github",
        providerSubject,
        login,
        displayName,
        avatarUrl,
        status: existing?.status ?? "active",
        createdAt: existing?.createdAt ?? createdAt,
        updatedAt,
        lastAuthenticatedAt,
      });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert or ignore into auth_user_roles")) {
      const [userId, grantedAt] = this.values as [string, string];
      void grantedAt;
      const roles = this.database.authRoles.get(userId) ?? new Set<string>();
      roles.add("viewer");
      this.database.authRoles.set(userId, roles);
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into auth_user_roles")) {
      const [userId, role] = this.values as [string, string];
      const roles = this.database.authRoles.get(userId) ?? new Set<string>();
      roles.add(role);
      this.database.authRoles.set(userId, roles);
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("delete from auth_user_roles")) {
      const [userId] = this.values as [string];
      this.database.authRoles.set(userId, new Set());
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("delete from auth_sessions")) {
      const [now] = this.values as [string];
      for (const [tokenHash, session] of this.database.authSessions) {
        if (session.expiresAt <= now || session.revokedAt) this.database.authSessions.delete(tokenHash);
      }
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("insert into auth_sessions")) {
      const [id, userId, tokenHash, createdAt, expiresAt, lastUsedAt] = this.values as [string, string, string, string, string, string];
      this.database.authSessions.set(tokenHash, { id, userId, tokenHash, createdAt, expiresAt, lastUsedAt, revokedAt: null });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("update auth_sessions set last_used_at")) {
      const [lastUsedAt, tokenHash] = this.values as [string, string];
      const session = this.database.authSessions.get(tokenHash);
      if (session) session.lastUsedAt = lastUsedAt;
      return { meta: { changes: session ? 1 : 0 } };
    }
    if (normalized.startsWith("update auth_sessions set revoked_at")) {
      const [revokedAt, tokenHash] = this.values as [string, string];
      const session = this.database.authSessions.get(tokenHash);
      if (session) session.revokedAt = revokedAt;
      return { meta: { changes: session ? 1 : 0 } };
    }
    if (normalized.startsWith("delete from intelligence_read_models")) {
      const [collection, before] = this.values as [string, string];
      let changes = 0;
      for (const [key, row] of this.database.readModels) {
        if (row.collection === collection && row.updatedAt < before) {
          this.database.readModels.delete(key);
          changes += 1;
        }
      }
      return { meta: { changes } };
    }
    return { meta: { changes: 0 } };
  }
}

export class FakeD1Database implements D1DocumentDatabase {
  readonly readModels = new Map<string, StoredReadModel>();
  readonly auditRows: unknown[][] = [];
  readonly authUsers = new Map<string, StoredAuthUser>();
  readonly authRoles = new Map<string, Set<string>>();
  readonly authSessions = new Map<string, StoredAuthSession>();
  readonly rateLimits = new Map<string, { count: number; expiresAt: number }>();
  readonly ingestionSubmissions = new Map<string, StoredIngestionSubmission>();
  readonly ingestionAttempts: Array<{ id: string; submissionId: string; attempt: number; state: string; startedAt: string; completedAt: string; requestId: string }> = [];
  readonly collectorRuns: StoredCollectorRun[] = [];

  prepare(query: string): D1PreparedStatementLike {
    return new FakeD1Statement(this, query);
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<D1MutationResultLike[]> {
    const results: D1MutationResultLike[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}
