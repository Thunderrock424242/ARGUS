import { POST as askAether } from "@/app/api/aether/route";
import { POST as actOnAlert } from "@/app/api/admin/alerts/[id]/route";
import { POST as seedDemoData } from "@/app/api/admin/demo-seed/route";
import { POST as runCollector } from "@/app/api/admin/collectors/run/route";
import { PUT as saveLayout } from "@/app/api/admin/layouts/[id]/route";
import { POST as reviewRelationship } from "@/app/api/admin/relationships/[id]/route";
import { POST as enforceRetention } from "@/app/api/admin/retention/route";
import { POST as reviewEvent } from "@/app/api/admin/review/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { PUT as updateUserRoles } from "@/app/api/admin/users/[id]/roles/route";
import { GET as getAuthConfig } from "@/app/api/auth/config/route";
import { POST as exchangeAuthCode } from "@/app/api/auth/exchange/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as getAuthSession } from "@/app/api/auth/session/route";
import { GET as getBrief } from "@/app/api/briefs/[slug]/route";
import { GET as getBriefs } from "@/app/api/briefs/route";
import { GET as getEvent } from "@/app/api/events/[slug]/route";
import { GET as getEvents } from "@/app/api/events/route";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getConflicts } from "@/app/api/conflicts/route";
import { GET as getMarketImpacts } from "@/app/api/market-impacts/route";
import { GET as getOperations } from "@/app/api/operations/route";
import { GET as getOperationsSnapshot } from "@/app/api/operations/snapshot/route";
import { GET as getRelationships } from "@/app/api/relationships/route";
import { GET as getReports } from "@/app/api/reports/route";
import { GET as search } from "@/app/api/search/route";
import { GET as getSources } from "@/app/api/sources/route";
import { jsonError, jsonResponse, requestIdFrom } from "@/lib/api/responses";
import { enforceReadModelRetention } from "@/packages/database/durable-operations";
import {
  D1IntelligenceDataProvider,
  type D1DocumentDatabase,
} from "@/packages/database/d1-read-model-provider";
import {
  configureIntelligenceDataProvider,
  resetIntelligenceDataProvider,
} from "@/packages/database/provider";

interface BrainEnv {
  ALLOWED_ORIGINS?: string;
  ARGUS_ADMIN_TOKEN?: string;
  AUTH_CALLBACK_URL?: string;
  AUTH_SESSION_TTL_SECONDS?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  RETENTION_DAYS?: string;
  DB?: D1DocumentDatabase;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "https://thunderrock424242.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function allowedOrigins(env: BrainEnv): Set<string> {
  const configured = env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

function withCors(response: Response, origin: string | null, dataStore?: "d1" | "fixtures"): Response {
  const headers = new Headers(response.headers);
  headers.set("vary", "Origin");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("access-control-expose-headers", "X-ARGUS-Data-Store, X-Request-ID");
  if (origin) headers.set("access-control-allow-origin", origin);
  if (dataStore) headers.set("x-argus-data-store", dataStore);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function preflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type, X-Request-ID",
      "access-control-max-age": "86400",
      "cross-origin-resource-policy": "cross-origin",
      vary: "Origin",
    },
  });
}

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function route(request: Request, env: BrainEnv): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/") {
    return jsonResponse({
      service: "ARGUS brain",
      status: "operational",
      dataClassification: "demonstration",
      dataStore: env.DB ? "d1-with-fixture-fallback" : "fixtures",
      administrativeRoutesExposed: Boolean(env.DB),
      administrativeRoutesProtected: true,
      bootstrapAccessEnabled: Boolean(env.DB && env.ARGUS_ADMIN_TOKEN),
      identityEnabled: Boolean(
        env.DB &&
        env.AUTH_CALLBACK_URL &&
        env.GITHUB_OAUTH_CLIENT_ID &&
        env.GITHUB_OAUTH_CLIENT_SECRET
      ),
    });
  }

  const adminContext = { adminToken: env.ARGUS_ADMIN_TOKEN, database: env.DB };
  const identityContext = {
    ...adminContext,
    githubOAuthClientId: env.GITHUB_OAUTH_CLIENT_ID,
    githubOAuthClientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
    authCallbackUrl: env.AUTH_CALLBACK_URL,
    authSessionTtlSeconds: env.AUTH_SESSION_TTL_SECONDS,
  };
  if (request.method === "GET" && pathname === "/api/auth/config") {
    return getAuthConfig(request, identityContext);
  }
  if (request.method === "POST" && pathname === "/api/auth/exchange") {
    return exchangeAuthCode(request, identityContext);
  }
  if (request.method === "GET" && pathname === "/api/auth/session") {
    return getAuthSession(request, adminContext);
  }
  if (request.method === "POST" && pathname === "/api/auth/logout") {
    return logout(request, adminContext);
  }
  if (pathname.startsWith("/api/auth")) {
    return jsonError(404, "not_found", "This identity API route does not exist.", {
      requestId: requestIdFrom(request),
    });
  }
  if (request.method === "POST" && pathname === "/api/admin/review") {
    return reviewEvent(request, adminContext);
  }
  if (request.method === "POST" && pathname === "/api/admin/demo-seed") {
    return seedDemoData(request, adminContext);
  }
  if (request.method === "POST" && pathname === "/api/admin/retention") {
    return enforceRetention(request, adminContext);
  }
  if (request.method === "POST" && pathname === "/api/admin/collectors/run") {
    return runCollector(request, adminContext);
  }
  if (request.method === "GET" && pathname === "/api/admin/users") {
    return listUsers(request, adminContext);
  }
  const userRolesMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/roles$/);
  if (request.method === "PUT" && userRolesMatch) {
    const id = decodePathSegment(userRolesMatch[1]);
    return id
      ? updateUserRoles(request, { ...adminContext, params: Promise.resolve({ id }) })
      : jsonError(400, "invalid_path", "The request path is invalid.", {
          requestId: requestIdFrom(request),
        });
  }
  const relationshipReviewMatch = pathname.match(/^\/api\/admin\/relationships\/([^/]+)$/);
  if (request.method === "POST" && relationshipReviewMatch) {
    const id = decodePathSegment(relationshipReviewMatch[1]);
    return id
      ? reviewRelationship(request, { ...adminContext, params: Promise.resolve({ id }) })
      : jsonError(400, "invalid_path", "The request path is invalid.", { requestId: requestIdFrom(request) });
  }
  const alertActionMatch = pathname.match(/^\/api\/admin\/alerts\/([^/]+)$/);
  if (request.method === "POST" && alertActionMatch) {
    const id = decodePathSegment(alertActionMatch[1]);
    return id
      ? actOnAlert(request, { ...adminContext, params: Promise.resolve({ id }) })
      : jsonError(400, "invalid_path", "The request path is invalid.", { requestId: requestIdFrom(request) });
  }
  const layoutSaveMatch = pathname.match(/^\/api\/admin\/layouts\/([^/]+)$/);
  if (request.method === "PUT" && layoutSaveMatch) {
    const id = decodePathSegment(layoutSaveMatch[1]);
    return id
      ? saveLayout(request, { ...adminContext, params: Promise.resolve({ id }) })
      : jsonError(400, "invalid_path", "The request path is invalid.", { requestId: requestIdFrom(request) });
  }
  if (pathname.startsWith("/api/admin")) {
    return jsonError(404, "not_found", "This administrative API route does not exist.", {
      requestId: requestIdFrom(request),
    });
  }

  if (request.method === "POST" && pathname === "/api/aether") {
    return askAether(request);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonError(405, "method_not_allowed", "This method is not supported.", {
      requestId: requestIdFrom(request),
    });
  }

  let response: Response;
  if (pathname === "/api/health") response = await getHealth(request);
  else if (pathname === "/api/events") response = await getEvents(request);
  else if (pathname === "/api/reports") response = await getReports(request);
  else if (pathname === "/api/sources") response = await getSources(request);
  else if (pathname === "/api/briefs") response = await getBriefs(request);
  else if (pathname === "/api/relationships") response = await getRelationships(request);
  else if (pathname === "/api/market-impacts") response = await getMarketImpacts(request);
  else if (pathname === "/api/conflicts") response = await getConflicts(request);
  else if (pathname === "/api/operations") response = await getOperations(request);
  else if (pathname === "/api/operations/snapshot") response = await getOperationsSnapshot(request);
  else if (pathname === "/api/search") response = await search(request);
  else {
    const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
    const briefMatch = pathname.match(/^\/api\/briefs\/([^/]+)$/);
    if (eventMatch) {
      const slug = decodePathSegment(eventMatch[1]);
      response = slug
        ? await getEvent(request, { params: Promise.resolve({ slug }) })
        : jsonError(400, "invalid_path", "The request path is invalid.", {
            requestId: requestIdFrom(request),
          });
    } else if (briefMatch) {
      const slug = decodePathSegment(briefMatch[1]);
      response = slug
        ? await getBrief(request, { params: Promise.resolve({ slug }) })
        : jsonError(400, "invalid_path", "The request path is invalid.", {
            requestId: requestIdFrom(request),
          });
    } else {
      response = jsonError(404, "not_found", "This public API route does not exist.", {
        requestId: requestIdFrom(request),
      });
    }
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  return response;
}

const worker = {
  async fetch(request: Request, env: BrainEnv): Promise<Response> {
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins(env).has(origin)) {
      return withCors(
        jsonError(403, "origin_not_allowed", "This browser origin is not allowed.", {
          requestId: requestIdFrom(request),
        }),
        null,
      );
    }
    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 204 });
      return preflight(origin);
    }
    if (env.DB) configureIntelligenceDataProvider(new D1IntelligenceDataProvider(env.DB));
    else resetIntelligenceDataProvider();
    return withCors(await route(request, env), origin, env.DB ? "d1" : "fixtures");
  },

  async scheduled(_controller: ScheduledController, env: BrainEnv, context: ExecutionContext): Promise<void> {
    if (!env.DB) return;
    const configuredDays = Number(env.RETENTION_DAYS ?? "180");
    const retentionDays = Number.isFinite(configuredDays)
      ? Math.max(30, Math.min(3_650, Math.trunc(configuredDays)))
      : 180;
    const before = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    context.waitUntil(
      Promise.all([
        enforceReadModelRetention(env.DB, before, undefined, {
          actorName: "ARGUS retention scheduler",
          actorType: "system",
          requestId: `scheduled-${crypto.randomUUID()}`,
        }),
        env.DB.batch([
          env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL").bind(new Date().toISOString()),
          env.DB.prepare("DELETE FROM auth_rate_limits WHERE expires_at <= ?").bind(Date.now()),
        ]),
      ]).then(() => undefined),
    );
  },
};

export default worker;
