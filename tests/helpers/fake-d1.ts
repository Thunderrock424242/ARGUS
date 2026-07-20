import type {
  D1DocumentDatabase,
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
    if (normalized.includes("from intelligence_read_models") && normalized.includes("collection = ?")) {
      const [collection] = this.values as [string];
      const rows = [...this.database.readModels.values()]
        .filter((row) => row.collection === collection)
        .sort((left, right) => left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt) || left.recordId.localeCompare(right.recordId))
        .map((row) => ({ document: row.document })) as T[];
      return { results: rows };
    }
    return { results: [] };
  }

  async first<T>(): Promise<T | null> {
    const normalized = this.query.toLocaleLowerCase("en-US");
    if (!normalized.includes("from intelligence_read_models")) return null;
    const [collection, identifier] = this.values as [string, string];
    const row = [...this.database.readModels.values()].find((candidate) =>
      candidate.collection === collection &&
      (normalized.includes("record_id = ?")
        ? candidate.recordId === identifier
        : candidate.slug === identifier),
    );
    return row ? ({ document: row.document } as T) : null;
  }

  async run(): Promise<unknown> {
    const normalized = this.query.trim().toLocaleLowerCase("en-US");
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
      this.database.auditRows.push([...this.values]);
      return { meta: { changes: 1 } };
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

  prepare(query: string): D1PreparedStatementLike {
    return new FakeD1Statement(this, query);
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}
