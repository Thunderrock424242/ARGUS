import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";
import type { AuditLogEntry } from "@/packages/shared/types";

interface AuditLogRow {
  id: string;
  occurred_at: string;
  actor_type: AuditLogEntry["actorType"];
  actor_id: string;
  actor_name: string;
  action: AuditLogEntry["action"];
  target_type: AuditLogEntry["targetType"];
  target_id: string;
  summary: string;
  before: string | null;
  after: string | null;
  reason: string | null;
  correlation_id: string;
  data_classification: AuditLogEntry["dataClassification"];
}

function decoded(value: string | null): unknown {
  if (value === null) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function auditEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorType: row.actor_type,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    summary: row.summary,
    before: decoded(row.before),
    after: decoded(row.after),
    reason: row.reason ?? undefined,
    correlationId: row.correlation_id,
    dataClassification: row.data_classification,
  };
}

export async function readAuditLogPage(
  database: D1DocumentDatabase,
  input: { page: number; limit: number; targetId?: string },
): Promise<{ entries: AuditLogEntry[]; hasMore: boolean }> {
  const offset = (input.page - 1) * input.limit;
  const selection = `SELECT id, occurred_at, actor_type, actor_id, actor_name, action,
    target_type, target_id, summary, before, after, reason, correlation_id, data_classification
    FROM audit_logs`;
  const statement = input.targetId
    ? database.prepare(`${selection} WHERE target_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`).bind(input.targetId, input.limit + 1, offset)
    : database.prepare(`${selection} ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`).bind(input.limit + 1, offset);
  const result = await statement.all<AuditLogRow>();
  const rows = result.results ?? [];
  return { entries: rows.slice(0, input.limit).map(auditEntry), hasMore: rows.length > input.limit };
}
