import { jsonData, jsonError, requestIdFrom } from "@/lib/api/responses";
import { readOrbitalSnapshot, type OrbitalLiveConfiguration } from "@/packages/database/orbital-store";
import type { D1DocumentDatabase } from "@/packages/database/d1-read-model-provider";

export const dynamic = "force-dynamic";

const DISABLED_CONFIGURATION: OrbitalLiveConfiguration = {
  enabled: false,
  celestrakEnabled: false,
  jplEnabled: false,
  donkiEnabled: false,
  nasaApiKeyConfigured: false,
};

export async function GET(
  request: Request,
  context: {
    database?: D1DocumentDatabase;
    orbitalConfig?: OrbitalLiveConfiguration;
    demoDataEnabled?: boolean;
  } = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  if (new URL(request.url).search) {
    return jsonError(422, "invalid_query", "The orbital snapshot endpoint does not accept query parameters.", { requestId });
  }
  try {
    const snapshot = await readOrbitalSnapshot(
      context.database,
      context.orbitalConfig ?? DISABLED_CONFIGURATION,
      { demoEnabled: context.demoDataEnabled ?? true },
    );
    return jsonData(snapshot, {
      meta: {
        requestId,
        source: context.database ? "orbital-d1-snapshots" : "orbital-fixtures",
        dataClassification: snapshot.dataClassification,
        warning: "Displayed positions may be propagated or modeled. ARGUS is not a flight-safety or collision-avoidance service.",
      },
    });
  } catch {
    return jsonError(503, "orbital_snapshot_unavailable", "The orbital snapshot is temporarily unavailable.", { requestId });
  }
}

