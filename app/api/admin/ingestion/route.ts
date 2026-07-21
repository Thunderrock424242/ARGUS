import { actorForRequest, requirePermission, type AuthorizationContext } from "@/lib/api/admin-guard";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { ingestionQuerySchema, ingestionSubmissionSchema } from "@/lib/api/schemas";
import { validateJsonBody, validateSearchParams } from "@/lib/api/validation";
import { assertPublicHttpUrl, PublicUrlValidationError } from "@/lib/security/public-url";
import {
  createIngestionSubmission,
  IngestionStoreError,
  readIngestionPage,
} from "@/packages/database/ingestion-store";
import { intelligenceDataProvider } from "@/packages/database/provider";
import { PUBLIC_INFORMATION_LABEL } from "@/packages/intelligence/collector-sources";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: AuthorizationContext = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "ingestion:read", "ingestion-read", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) {
    return jsonError(503, "durable_store_unavailable", "D1 is required for ingestion reads.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  const query = validateSearchParams(new URL(request.url).searchParams, ingestionQuerySchema);
  if (!query.success) {
    return jsonError(query.status, query.code, query.message, {
      details: query.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  try {
    const result = await readIngestionPage(context.database, query.data);
    return jsonData(result.submissions, {
      headers: guard.rateLimitHeaders,
      meta: {
        requestId,
        page: query.data.page,
        limit: query.data.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.data.limit)),
      },
    });
  } catch {
    return jsonError(503, "ingestion_unavailable", "The ingestion queue could not be loaded.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}

export async function POST(request: Request, context: AuthorizationContext = {}): Promise<Response> {
  const requestId = requestIdFrom(request);
  const guard = await requirePermission(request, "ingestion:submit", "ingestion-submit", requestId, context);
  if (!guard.authorized) return guard.response;
  if (!context.database) {
    return jsonError(503, "durable_store_unavailable", "D1 is required for ingestion submissions.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  const body = await validateJsonBody(request, ingestionSubmissionSchema);
  if (!body.success) {
    return jsonError(body.status, body.code, body.message, {
      details: body.details,
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
  try {
    assertPublicHttpUrl(body.data.url, { requireHttps: true });
    const source = (await intelligenceDataProvider.getSources()).find(
      (candidate) => candidate.id === body.data.sourceId,
    );
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
    const result = await createIngestionSubmission(
      context.database,
      body.data,
      actorForRequest(guard.principal),
      requestId,
      {
        method: "manual",
        dataClassification: "public-information",
        dataLabel: PUBLIC_INFORMATION_LABEL,
      },
    );
    return jsonData(result.submission, {
      status: result.idempotent ? 200 : 201,
      headers: guard.rateLimitHeaders,
      meta: {
        requestId,
        idempotent: result.idempotent,
        notice: result.submission.status === "duplicate"
          ? "The content matches an existing canonical report and was retained as a duplicate intake record."
          : `The public report is visible at ${result.submission.confidence}% confidence while it awaits an explicit reviewer decision.`,
      },
    });
  } catch (error) {
    if (error instanceof PublicUrlValidationError) {
      return jsonError(422, "unsafe_source_url", error.message, {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    if (error instanceof IngestionStoreError) {
      return jsonError(error.status, error.code, error.message, {
        requestId,
        headers: guard.rateLimitHeaders,
      });
    }
    return jsonError(503, "ingestion_unavailable", "The submission could not be ingested.", {
      requestId,
      headers: guard.rateLimitHeaders,
    });
  }
}
