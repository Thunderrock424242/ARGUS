export const ARGUS_ROLES = [
  "viewer",
  "analyst",
  "reviewer",
  "source-manager",
  "administrator",
] as const;

export type ArgusRole = (typeof ARGUS_ROLES)[number];

export const ARGUS_PERMISSIONS = [
  "profile:read",
  "alerts:act",
  "layouts:write",
  "events:review",
  "relationships:review",
  "ingestion:read",
  "ingestion:submit",
  "ingestion:review",
  "ingestion:retry",
  "collectors:run",
  "retention:enforce",
  "demo:seed",
  "identity:manage",
] as const;

export type ArgusPermission = (typeof ARGUS_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Readonly<Record<ArgusRole, readonly ArgusPermission[]>> = {
  viewer: ["profile:read"],
  analyst: [
    "profile:read",
    "alerts:act",
    "layouts:write",
    "ingestion:read",
    "ingestion:submit",
  ],
  reviewer: [
    "profile:read",
    "alerts:act",
    "layouts:write",
    "events:review",
    "relationships:review",
    "ingestion:read",
    "ingestion:submit",
    "ingestion:review",
  ],
  "source-manager": [
    "profile:read",
    "alerts:act",
    "layouts:write",
    "ingestion:read",
    "ingestion:submit",
    "ingestion:retry",
    "collectors:run",
  ],
  administrator: ARGUS_PERMISSIONS,
};

export interface AuthPrincipal {
  id: string;
  provider: "github" | "bootstrap";
  providerSubject?: string;
  login: string;
  displayName: string;
  avatarUrl?: string;
  roles: ArgusRole[];
  permissions: ArgusPermission[];
  authMethod: "oauth-session" | "bootstrap-token";
  sessionExpiresAt?: string;
}

export interface AuthUserSummary {
  id: string;
  provider: "github";
  providerSubject: string;
  login: string;
  displayName: string;
  avatarUrl?: string;
  status: "active" | "disabled";
  roles: ArgusRole[];
  createdAt: string;
  updatedAt: string;
  lastAuthenticatedAt: string;
}

export interface AuthPublicConfiguration {
  enabled: boolean;
  provider: "github";
  clientId?: string;
  callbackUrl?: string;
  authorizeUrl: string;
  pkceMethod: "S256";
}

export interface AuthSessionEstablished {
  credential: string;
  principal: AuthPrincipal;
}

export function isArgusRole(value: string): value is ArgusRole {
  return (ARGUS_ROLES as readonly string[]).includes(value);
}

export function permissionsForRoles(roles: readonly ArgusRole[]): ArgusPermission[] {
  const permissions = new Set<ArgusPermission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) permissions.add(permission);
  }
  return ARGUS_PERMISSIONS.filter((permission) => permissions.has(permission));
}

export function principalHasPermission(
  principal: Pick<AuthPrincipal, "permissions">,
  permission: ArgusPermission,
): boolean {
  return principal.permissions.includes(permission);
}

export function normalizeRoles(roles: readonly ArgusRole[]): ArgusRole[] {
  const unique = new Set<ArgusRole>(["viewer", ...roles]);
  return ARGUS_ROLES.filter((role) => unique.has(role));
}
