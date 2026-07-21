import type { AuditAction, AuditLogEntry } from "@/packages/shared/types";

export interface AuditRecorder {
  record(entry: AuditLogEntry): Promise<void>;
  recent?(limit?: number): Promise<AuditLogEntry[]>;
}

/** Process-local recorder for development and unit tests; it is deliberately bounded. */
export class MemoryAuditRecorder implements AuditRecorder {
  private readonly entries: AuditLogEntry[] = [];

  constructor(private readonly maximumEntries = 500) {}

  async record(entry: AuditLogEntry): Promise<void> {
    this.entries.unshift(structuredClone(entry));
    if (this.entries.length > this.maximumEntries) this.entries.length = this.maximumEntries;
  }

  async recent(limit = 100): Promise<AuditLogEntry[]> {
    return structuredClone(this.entries.slice(0, Math.max(0, Math.min(limit, 500))));
  }
}

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  run(): Promise<unknown>;
}

export interface D1AuditDatabase {
  prepare(query: string): D1PreparedStatementLike;
}

/** Adapter for the `audit_logs` table declared in db/schema.ts. */
export class D1AuditRecorder implements AuditRecorder {
  constructor(private readonly database: D1AuditDatabase) {}

  async record(entry: AuditLogEntry): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO audit_logs (
          id, occurred_at, actor_type, actor_id, actor_name, action,
          target_type, target_id, summary, before, after, reason,
          correlation_id, data_classification
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entry.id,
        entry.occurredAt,
        entry.actorType,
        entry.actorId,
        entry.actorName,
        entry.action,
        entry.targetType,
        entry.targetId,
        entry.summary,
        entry.before === undefined ? null : JSON.stringify(entry.before),
        entry.after === undefined ? null : JSON.stringify(entry.after),
        entry.reason ?? null,
        entry.correlationId,
        entry.dataClassification,
      )
      .run();
  }
}

export interface CreateAuditEntryInput {
  action: AuditAction;
  targetType: AuditLogEntry["targetType"];
  targetId: string;
  actorName: string;
  summary: string;
  requestId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  occurredAt?: string;
  actorType?: AuditLogEntry["actorType"];
  actorId?: string;
  dataClassification?: AuditLogEntry["dataClassification"];
}

function actorIdentifier(name: string, actorType: AuditLogEntry["actorType"]): string {
  return `${actorType}:${name.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").slice(0, 64)}`;
}

export function createAuditEntry(input: CreateAuditEntryInput): AuditLogEntry {
  const actorType = input.actorType ?? "analyst";
  return {
    id: `audit-${crypto.randomUUID()}`,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    actorId: input.actorId ?? actorIdentifier(input.actorName, actorType),
    actorName: input.actorName,
    actorType,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    before: input.before,
    after: input.after,
    reason: input.reason,
    correlationId: input.requestId,
    dataClassification: input.dataClassification ?? "demonstration",
  };
}

export const auditRecorder: AuditRecorder = new MemoryAuditRecorder();
