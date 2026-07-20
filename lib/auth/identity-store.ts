import { createAuditEntry } from "@/lib/audit/recorder";
import { createSessionCredential, sha256Hex } from "@/lib/auth/tokens";
import type {
  ArgusRole,
  AuthPrincipal,
  AuthUserSummary,
} from "@/packages/shared/auth";
import {
  isArgusRole,
  normalizeRoles,
  permissionsForRoles,
} from "@/packages/shared/auth";
import type {
  D1DocumentDatabase,
  D1PreparedStatementLike,
} from "@/packages/database/d1-read-model-provider";

export interface GitHubIdentityProfile {
  id: number;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface IdentityActor {
  id: string;
  name: string;
}

interface IdentityUserRow {
  id: string;
  provider: "github";
  provider_subject: string;
  login: string;
  display_name: string;
  avatar_url: string | null;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  last_authenticated_at: string;
  roles: string | null;
}

interface SessionRow extends IdentityUserRow {
  session_expires_at: string;
}

function rolesFromRow(value: string | null): ArgusRole[] {
  const roles = (value ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(isArgusRole);
  return normalizeRoles(roles);
}

function principalFromRow(row: SessionRow): AuthPrincipal {
  const roles = rolesFromRow(row.roles);
  return {
    id: row.id,
    provider: "github",
    providerSubject: row.provider_subject,
    login: row.login,
    displayName: row.display_name,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    roles,
    permissions: permissionsForRoles(roles),
    authMethod: "oauth-session",
    sessionExpiresAt: row.session_expires_at,
  };
}

function userFromRow(row: IdentityUserRow): AuthUserSummary {
  return {
    id: row.id,
    provider: "github",
    providerSubject: row.provider_subject,
    login: row.login,
    displayName: row.display_name,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    status: row.status,
    roles: rolesFromRow(row.roles),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAuthenticatedAt: row.last_authenticated_at,
  };
}

function auditInsert(
  database: D1DocumentDatabase,
  entry: ReturnType<typeof createAuditEntry>,
): D1PreparedStatementLike {
  return database
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
    );
}

export class IdentityStoreError extends Error {
  override readonly name = "IdentityStoreError";

  constructor(
    readonly status: 404 | 409 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class D1IdentityStore {
  constructor(private readonly database: D1DocumentDatabase) {}

  async authenticateSession(
    credential: string,
    now = new Date().toISOString(),
  ): Promise<AuthPrincipal | null> {
    const tokenHash = await sha256Hex(credential);
    const row = await this.database
      .prepare(
        `SELECT
          u.id, u.provider, u.provider_subject, u.login, u.display_name,
          u.avatar_url, u.status, u.created_at, u.updated_at,
          u.last_authenticated_at, s.expires_at AS session_expires_at,
          GROUP_CONCAT(ur.role) AS roles
        FROM auth_sessions s
        JOIN auth_users u ON u.id = s.user_id
        LEFT JOIN auth_user_roles ur ON ur.user_id = u.id
        WHERE s.token_hash = ?
          AND s.revoked_at IS NULL
          AND s.expires_at > ?
          AND u.status = 'active'
        GROUP BY u.id, s.id`,
      )
      .bind(tokenHash, now)
      .first<SessionRow>();
    if (!row) return null;
    await this.database
      .prepare("UPDATE auth_sessions SET last_used_at = ? WHERE token_hash = ?")
      .bind(now, tokenHash)
      .run();
    return principalFromRow(row);
  }

  async createGitHubSession(
    profile: GitHubIdentityProfile,
    ttlSeconds: number,
    now = new Date(),
  ): Promise<{ credential: string; principal: AuthPrincipal }> {
    const occurredAt = now.toISOString();
    const userId = `user:github:${profile.id}`;
    const displayName = profile.name?.trim() || profile.login;
    await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO auth_users (
            id, provider, provider_subject, login, display_name, avatar_url,
            status, created_at, updated_at, last_authenticated_at
          ) VALUES (?, 'github', ?, ?, ?, ?, 'active', ?, ?, ?)
          ON CONFLICT(provider, provider_subject) DO UPDATE SET
            login = excluded.login,
            display_name = excluded.display_name,
            avatar_url = excluded.avatar_url,
            updated_at = excluded.updated_at,
            last_authenticated_at = excluded.last_authenticated_at`,
        )
        .bind(
          userId,
          String(profile.id),
          profile.login,
          displayName,
          profile.avatarUrl ?? null,
          occurredAt,
          occurredAt,
          occurredAt,
        ),
      this.database
        .prepare(
          `INSERT OR IGNORE INTO auth_user_roles (
            user_id, role, granted_at, granted_by
          ) VALUES (?, 'viewer', ?, 'system:oauth-onboarding')`,
        )
        .bind(userId, occurredAt),
      this.database
        .prepare("DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL")
        .bind(occurredAt),
    ]);

    const credential = createSessionCredential();
    const tokenHash = await sha256Hex(credential);
    const sessionId = `session-${crypto.randomUUID()}`;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1_000).toISOString();
    await this.database
      .prepare(
        `INSERT INTO auth_sessions (
          id, user_id, token_hash, created_at, expires_at, last_used_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(sessionId, userId, tokenHash, occurredAt, expiresAt, occurredAt)
      .run();

    const principal = await this.authenticateSession(credential, occurredAt);
    if (!principal) {
      throw new IdentityStoreError(503, "session_creation_failed", "The new identity session could not be loaded.");
    }
    return { credential, principal };
  }

  async revokeSession(credential: string, now = new Date().toISOString()): Promise<void> {
    const tokenHash = await sha256Hex(credential);
    await this.database
      .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
      .bind(now, tokenHash)
      .run();
  }

  async listUsers(): Promise<AuthUserSummary[]> {
    const result = await this.database
      .prepare(
        `SELECT
          u.id, u.provider, u.provider_subject, u.login, u.display_name,
          u.avatar_url, u.status, u.created_at, u.updated_at,
          u.last_authenticated_at, GROUP_CONCAT(ur.role) AS roles
        FROM auth_users u
        LEFT JOIN auth_user_roles ur ON ur.user_id = u.id
        GROUP BY u.id
        ORDER BY u.login COLLATE NOCASE`,
      )
      .all<IdentityUserRow>();
    return (result.results ?? []).map(userFromRow);
  }

  async replaceRoles(
    userId: string,
    requestedRoles: readonly ArgusRole[],
    actor: IdentityActor,
    requestId: string,
    reason?: string,
  ): Promise<AuthUserSummary> {
    const users = await this.listUsers();
    const target = users.find((user) => user.id === userId);
    if (!target) throw new IdentityStoreError(404, "user_not_found", "The identity does not exist.");
    const roles = normalizeRoles(requestedRoles);
    const administrators = users.filter((user) => user.roles.includes("administrator"));
    if (
      target.roles.includes("administrator") &&
      !roles.includes("administrator") &&
      administrators.length <= 1
    ) {
      throw new IdentityStoreError(
        409,
        "last_administrator",
        "The final administrator role cannot be removed.",
      );
    }

    const occurredAt = new Date().toISOString();
    const audit = createAuditEntry({
      action: "identity-roles-updated",
      targetType: "user",
      targetId: userId,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} updated roles for ${target.login}.`,
      requestId,
      before: { roles: target.roles },
      after: { roles },
      reason,
      occurredAt,
    });
    const statements: D1PreparedStatementLike[] = [
      this.database.prepare("DELETE FROM auth_user_roles WHERE user_id = ?").bind(userId),
      ...roles.map((role) =>
        this.database
          .prepare(
            `INSERT INTO auth_user_roles (
              user_id, role, granted_at, granted_by
            ) VALUES (?, ?, ?, ?)`,
          )
          .bind(userId, role, occurredAt, actor.id),
      ),
      auditInsert(this.database, audit),
    ];
    await this.database.batch(statements);
    const updated = (await this.listUsers()).find((user) => user.id === userId);
    if (!updated) {
      throw new IdentityStoreError(503, "role_update_failed", "The updated identity could not be loaded.");
    }
    return updated;
  }
}
