import { z } from "zod";
import { actorForRequest, requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateJsonBody } from "@/lib/api/validation";
import { createAuditEntry, D1AuditRecorder } from "@/lib/audit/recorder";
import { runOrbitalSourceSync, type OrbitalLiveConfiguration } from "@/packages/database/orbital-store";
import type { OrbitalSourceTransport } from "@/packages/orbital/worker-source-transport";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  force: z.boolean().default(false),
  analystName: z.string().trim().min(1).max(100).default("Deployment Operator"),
}).strict();

export interface OrbitalSyncAuthorizationContext extends AuthorizationContext {
  orbitalConfig?: OrbitalLiveConfiguration;
  orbitalTransport?: OrbitalSourceTransport;
}

export async function POST(
  request: Request,
  context: OrbitalSyncAuthorizationContext = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "collectors:run", "orbital-sync", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database || !context.orbitalConfig || !context.orbitalTransport) {
    return jsonError(503, "orbital_runtime_unavailable", "The durable orbital sync runtime is not configured.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  const body = await validateJsonBody(request, requestSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  if (!context.orbitalConfig.enabled) {
    return jsonError(409, "orbital_sync_disabled", "Orbital live synchronization is disabled in Worker configuration.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  try {
    const results = await runOrbitalSourceSync(
      context.database,
      context.orbitalConfig,
      context.orbitalTransport,
      new Date(),
      { force: body.data.force },
    );
    const actor = actorForRequest(guard.principal, body.data.analystName);
    const audit = createAuditEntry({
      action: "collector-run",
      targetType: "collector",
      targetId: "orbital-watch",
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} requested a bounded orbital source synchronization.`,
      requestId,
      dataClassification: "public-information",
      after: {
        force: body.data.force,
        sources: results.map((result) => ({ sourceId: result.sourceId, status: result.status, recordCount: result.recordCount })),
      },
    });
    await new D1AuditRecorder(context.database).record(audit);
    return jsonData({ results, auditId: audit.id }, {
      status: 202,
      headers: guard.rateLimitHeaders,
      meta: { requestId, notice: "Source snapshots remain separate from ARGUS intelligence events and alerts." },
    });
  } catch {
    return jsonError(503, "orbital_sync_failed", "The orbital source synchronization could not be completed.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}

