import { intelligenceDataProvider } from "@/packages/database/provider";
import { DEMONSTRATION_DATA_LABEL } from "@/lib/api/read-models";
import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { routeIdentifierSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

interface BriefRouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: BriefRouteContext): Promise<Response> {
  const requestId = requestIdFrom(request);
  const parsedSlug = routeIdentifierSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) {
    return jsonError(422, "invalid_brief_slug", "The brief slug is invalid.", { requestId });
  }

  try {
    const brief = (await intelligenceDataProvider.getBriefs()).find(
      (candidate) => candidate.slug.toLocaleLowerCase("en-US") === parsedSlug.data.toLocaleLowerCase("en-US"),
    );
    if (!brief) {
      return jsonError(404, "brief_not_found", "No intelligence brief exists with that slug.", {
        requestId,
      });
    }
    return jsonData(brief, {
      meta: {
        requestId,
        dataClassification: "demonstration",
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      },
    });
  } catch {
    return jsonError(503, "data_unavailable", "Brief data is temporarily unavailable.", {
      requestId,
    });
  }
}
