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

  prepare(query: string): D1PreparedStatementLike {
    return new FakeD1Statement(this, query);
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}
