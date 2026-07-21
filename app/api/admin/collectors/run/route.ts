import { z } from "zod";
import { actorForRequest, requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { validateJsonBody } from "@/lib/api/validation";
import { createAuditEntry, D1AuditRecorder } from "@/lib/audit/recorder";
import { assertPublicHttpUrl, PublicUrlValidationError } from "@/lib/security/public-url";
import { intelligenceDataProvider } from "@/packages/database/provider";
import { runCollectorPilotSource } from "@/packages/database/collector-pilot";
import {
  collectorPilotDefinitions,
  createCollectorJob,
  createDefaultCollectors,
  executeCollectorJob,
} from "@/packages/intelligence";

export const dynamic = "force-dynamic";

const collectorRunSchema = z
  .object({
    collectorId: z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/),
    sourceId: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
    analystName: z.string().trim().min(1).max(100).default("Deployment Operator"),
    mode: z.enum(["dry-run", "ingest"]).default("dry-run"),
    since: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Must be a valid date-time.").optional(),
    cursor: z.string().trim().min(1).max(512).optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: AuthorizationContext = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "collectors:run", "collector-run", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) {
    return jsonError(503, "durable_store_unavailable", "D1 is required for controlled collector runs.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }

  const body = await validateJsonBody(request, collectorRunSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }

  try {
    const actor = actorForRequest(guard.principal, body.data.analystName);
    if (body.data.mode === "ingest") {
      if (!context.collectorConfig || !context.collectorTransport) {
        return jsonError(503, "collector_runtime_unavailable", "The live collector runtime is not configured.", {
          requestId,
          headers: guard.rateLimitHeaders,
        });
      }
      const definition = collectorPilotDefinitions(context.collectorConfig).find(
        (candidate) => candidate.collectorId === body.data.collectorId && candidate.source.id === body.data.sourceId,
      );
      if (!definition) {
        return jsonError(404, "collector_source_not_found", "The selected official collector source is not registered.", {
          requestId,
          headers: guard.rateLimitHeaders,
        });
      }
      if (!definition.active) {
        return jsonError(409, "collector_source_disabled", definition.disabledReason ?? "The selected source is disabled.", {
          requestId,
          headers: guard.rateLimitHeaders,
        });
      }
      const result = await runCollectorPilotSource(
        context.database,
        definition,
        context.collectorTransport,
      );
      const audit = createAuditEntry({
        action: "collector-run",
        targetType: "collector",
        targetId: definition.collectorId,
        actorId: actor.id,
        actorName: actor.name,
        summary: `${actor.name} ran ${definition.source.name} through the protected collector pilot.`,
        requestId,
        dataClassification: "public-information",
        after: {
          runId: result.run.id,
          status: result.run.status,
          sourceId: definition.source.id,
          reportsSeen: result.run.reportsSeen,
          reportsInserted: result.run.reportsInserted,
          duplicatesSkipped: result.run.duplicatesSkipped,
          networkAccessed: true,
        },
      });
      await new D1AuditRecorder(context.database).record(audit);
      return jsonData(
        {
          run: result.run,
          ingestionSubmissionIds: result.ingestionSubmissionIds,
          networkAccessed: true,
          persistence: "protected-ingestion-queue",
          auditId: audit.id,
          dataClassification: "public-information",
        },
        {
          status: 202,
          headers: guard.rateLimitHeaders,
          meta: {
            requestId,
            notice: "No collected item is public until a reviewer explicitly approves it.",
          },
        },
      );
    }

    const sources = await intelligenceDataProvider.getSources();
    const source = sources.find((candidate) => candidate.id === body.data.sourceId);
    if (!source) {
      return jsonError(404, "source_not_found", "The selected source does not exist.", {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    if (!source.enabled) {
      return jsonError(409, "source_disabled", "The selected source is disabled.", {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    assertPublicHttpUrl(source.url, { requireHttps: true });

    const collectors = createDefaultCollectors({ mode: "dry-run", maximumReports: 25 });
    const collector = collectors.find((candidate) => candidate.id === body.data.collectorId);
    if (!collector) {
      return jsonError(404, "collector_not_found", "The selected collector is not registered.", {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }

    const scheduledFor = new Date().toISOString();
    const job = createCollectorJob(collector, source, scheduledFor, {
      since: body.data.since,
      cursor: body.data.cursor,
    });
    const result = await executeCollectorJob(collector, source, job);
    const audit = createAuditEntry({
      action: "collector-run",
      targetType: "collector",
      targetId: collector.id,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} ran ${collector.name} in dry-run mode for ${source.name}.`,
      requestId,
      after: {
        runId: result.run.id,
        status: result.run.status,
        sourceId: source.id,
        reportsSeen: result.run.reportsSeen,
        networkAccessed: false,
      },
    });
    await new D1AuditRecorder(context.database).record(audit);

    return jsonData(
      {
        run: result.run,
        reports: result.reports,
        networkAccessed: false,
        persistence: "not-persisted",
        auditId: audit.id,
        dataClassification: "demonstration",
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      },
      {
        status: 202,
        headers: guard.rateLimitHeaders,
        meta: {
          requestId,
          notice: "Administrative API runs are intentionally dry-run only.",
        },
      },
    );
  } catch (error) {
    if (error instanceof PublicUrlValidationError) {
      return jsonError(422, "unsafe_source_url", error.message, {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    return jsonError(503, "collector_unavailable", "The collector run could not be completed.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}
