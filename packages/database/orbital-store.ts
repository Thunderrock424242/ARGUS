import type {
  CloseApproach,
  EarthOrbitObject,
  ImpactRiskRecord,
  OrbitalSnapshot,
  OrbitalSourceStatus,
  SpaceWeatherEvent,
} from "@/packages/shared/orbital-types";
import {
  createDemoOrbitalSnapshot,
  ORBITAL_DEMONSTRATION_LABEL,
} from "@/packages/shared/orbital-demo-data";
import type {
  OrbitalSourceFetchResult,
  OrbitalSourceTransport,
} from "@/packages/orbital/worker-source-transport";
import type {
  D1DocumentDatabase,
  D1PreparedStatementLike,
} from "./d1-read-model-provider";

export interface OrbitalLiveConfiguration {
  enabled: boolean;
  celestrakEnabled: boolean;
  jplEnabled: boolean;
  donkiEnabled: boolean;
  nasaApiKeyConfigured: boolean;
}

interface OrbitalSourceDefinition {
  id: OrbitalSourceStatus["id"];
  name: string;
  organization: string;
  sourceUrl: string;
  refreshMinutes: number;
  active(config: OrbitalLiveConfiguration): boolean;
  disabledReason(config: OrbitalLiveConfiguration): string;
}

interface OrbitalSourceSnapshotRow {
  source_id: OrbitalSourceStatus["id"];
  status: "online" | "degraded" | "unavailable";
  payload: string | unknown[];
  source_version: string | null;
  source_timestamp: string | null;
  record_count: number;
  last_attempt_at: string;
  last_successful_at: string | null;
  next_refresh_at: string;
  error_message: string | null;
}

export interface OrbitalSyncResult {
  sourceId: OrbitalSourceStatus["id"];
  status: "succeeded" | "failed" | "skipped";
  recordCount: number;
  message: string;
}

const SOURCE_DEFINITIONS: readonly OrbitalSourceDefinition[] = [
  {
    id: "celestrak-stations",
    name: "CelesTrak stations GP",
    organization: "CelesTrak",
    sourceUrl: "https://celestrak.org/NORAD/elements/",
    refreshMinutes: 120,
    active: (config) => config.enabled && config.celestrakEnabled,
    disabledReason: (config) => !config.enabled ? "Orbital live sync is globally disabled." : "CelesTrak sync is disabled.",
  },
  {
    id: "jpl-close-approaches",
    name: "SBDB close approaches",
    organization: "NASA/JPL CNEOS",
    sourceUrl: "https://ssd-api.jpl.nasa.gov/doc/cad.html",
    refreshMinutes: 360,
    active: (config) => config.enabled && config.jplEnabled,
    disabledReason: (config) => !config.enabled ? "Orbital live sync is globally disabled." : "NASA/JPL sync is disabled.",
  },
  {
    id: "jpl-sentry",
    name: "Sentry impact monitoring",
    organization: "NASA/JPL CNEOS",
    sourceUrl: "https://ssd-api.jpl.nasa.gov/doc/sentry.html",
    refreshMinutes: 360,
    active: (config) => config.enabled && config.jplEnabled,
    disabledReason: (config) => !config.enabled ? "Orbital live sync is globally disabled." : "NASA/JPL sync is disabled.",
  },
  {
    id: "nasa-donki",
    name: "DONKI space weather",
    organization: "NASA",
    sourceUrl: "https://api.nasa.gov/",
    refreshMinutes: 15,
    active: (config) => config.enabled && config.donkiEnabled && config.nasaApiKeyConfigured,
    disabledReason: (config) => {
      if (!config.enabled) return "Orbital live sync is globally disabled.";
      if (!config.donkiEnabled) return "NASA DONKI sync is disabled.";
      return "NASA_API_KEY is not configured.";
    },
  },
] as const;

function nextRefresh(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

function successStatement(
  database: D1DocumentDatabase,
  definition: OrbitalSourceDefinition,
  result: OrbitalSourceFetchResult,
  now: Date,
): D1PreparedStatementLike {
  const timestamp = now.toISOString();
  return database.prepare(
    `INSERT INTO orbital_source_snapshots (
      source_id, status, payload, source_version, source_timestamp, record_count,
      last_attempt_at, last_successful_at, next_refresh_at, error_message, updated_at
    ) VALUES (?, 'online', ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(source_id) DO UPDATE SET
      status = 'online', payload = excluded.payload,
      source_version = excluded.source_version, source_timestamp = excluded.source_timestamp,
      record_count = excluded.record_count, last_attempt_at = excluded.last_attempt_at,
      last_successful_at = excluded.last_successful_at, next_refresh_at = excluded.next_refresh_at,
      error_message = NULL, updated_at = excluded.updated_at`,
  ).bind(
    definition.id,
    JSON.stringify(result.records),
    result.sourceVersion,
    result.sourceTimestamp ?? null,
    result.records.length,
    timestamp,
    timestamp,
    nextRefresh(now, definition.refreshMinutes),
    timestamp,
  );
}

function failureStatement(
  database: D1DocumentDatabase,
  definition: OrbitalSourceDefinition,
  now: Date,
  message: string,
): D1PreparedStatementLike {
  const timestamp = now.toISOString();
  return database.prepare(
    `INSERT INTO orbital_source_snapshots (
      source_id, status, payload, source_version, source_timestamp, record_count,
      last_attempt_at, last_successful_at, next_refresh_at, error_message, updated_at
    ) VALUES (?, 'unavailable', '[]', NULL, NULL, 0, ?, NULL, ?, ?, ?)
    ON CONFLICT(source_id) DO UPDATE SET
      status = CASE WHEN orbital_source_snapshots.last_successful_at IS NULL THEN 'unavailable' ELSE 'degraded' END,
      last_attempt_at = excluded.last_attempt_at,
      next_refresh_at = excluded.next_refresh_at,
      error_message = excluded.error_message,
      updated_at = excluded.updated_at`,
  ).bind(
    definition.id,
    timestamp,
    nextRefresh(now, Math.min(15, definition.refreshMinutes)),
    message.slice(0, 500),
    timestamp,
  );
}

async function sourceRow(
  database: D1DocumentDatabase,
  sourceId: OrbitalSourceStatus["id"],
): Promise<OrbitalSourceSnapshotRow | null> {
  return database.prepare(
    `SELECT source_id, status, payload, source_version, source_timestamp, record_count,
      last_attempt_at, last_successful_at, next_refresh_at, error_message
     FROM orbital_source_snapshots WHERE source_id = ?`,
  ).bind(sourceId).first<OrbitalSourceSnapshotRow>();
}

function due(row: OrbitalSourceSnapshotRow | null, now: Date, force: boolean): boolean {
  if (force || !row) return true;
  const at = Date.parse(row.next_refresh_at);
  return !Number.isFinite(at) || at <= now.getTime();
}

export async function runOrbitalSourceSync(
  database: D1DocumentDatabase,
  config: OrbitalLiveConfiguration,
  transport: OrbitalSourceTransport,
  now = new Date(),
  options: { force?: boolean } = {},
): Promise<OrbitalSyncResult[]> {
  const results: OrbitalSyncResult[] = [];
  for (const definition of SOURCE_DEFINITIONS) {
    if (!definition.active(config)) {
      results.push({ sourceId: definition.id, status: "skipped", recordCount: 0, message: definition.disabledReason(config) });
      continue;
    }
    let existing: OrbitalSourceSnapshotRow | null;
    try {
      existing = await sourceRow(database, definition.id);
    } catch {
      existing = null;
    }
    if (!due(existing, now, options.force ?? false)) {
      results.push({ sourceId: definition.id, status: "skipped", recordCount: existing?.record_count ?? 0, message: "The current snapshot is still fresh." });
      continue;
    }
    try {
      const fetched = await transport.fetchSource(definition.id, now);
      await successStatement(database, definition, fetched, now).run();
      results.push({ sourceId: definition.id, status: "succeeded", recordCount: fetched.records.length, message: "Source snapshot synchronized." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown orbital source failure.";
      await failureStatement(database, definition, now, message).run();
      results.push({ sourceId: definition.id, status: "failed", recordCount: existing?.record_count ?? 0, message });
    }
  }
  return results;
}

function decodeArray<T>(value: OrbitalSourceSnapshotRow["payload"]): T[] | null {
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed as T[] : null;
  } catch {
    return null;
  }
}

function publicStatus(
  definition: OrbitalSourceDefinition,
  row: OrbitalSourceSnapshotRow | undefined,
  config: OrbitalLiveConfiguration,
  now: Date,
): OrbitalSourceStatus {
  if (!definition.active(config)) {
    return {
      id: definition.id,
      name: definition.name,
      organization: definition.organization,
      sourceUrl: definition.sourceUrl,
      status: "disabled",
      recordCount: 0,
      message: definition.disabledReason(config),
      dataClassification: "public-information",
    };
  }
  if (!row) {
    return {
      id: definition.id,
      name: definition.name,
      organization: definition.organization,
      sourceUrl: definition.sourceUrl,
      status: "unavailable",
      recordCount: 0,
      message: "No synchronized source snapshot is available yet.",
      dataClassification: "public-information",
    };
  }
  const stale = row.last_successful_at !== null && Date.parse(row.next_refresh_at) < now.getTime();
  return {
    id: definition.id,
    name: definition.name,
    organization: definition.organization,
    sourceUrl: definition.sourceUrl,
    status: stale && row.status === "online" ? "stale" : row.status,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessfulAt: row.last_successful_at ?? undefined,
    nextRefreshAt: row.next_refresh_at,
    sourceVersion: row.source_version ?? undefined,
    recordCount: row.record_count,
    message: row.error_message ?? (stale ? "The last successful snapshot is older than its refresh policy." : "Synchronized source snapshot available."),
    dataClassification: "public-information",
  };
}

function fixtureRecordsFor(
  snapshot: OrbitalSnapshot,
  sourceId: OrbitalSourceStatus["id"],
): EarthOrbitObject[] | CloseApproach[] | ImpactRiskRecord[] | SpaceWeatherEvent[] {
  if (sourceId === "celestrak-stations") return snapshot.earthOrbitObjects;
  if (sourceId === "jpl-close-approaches") return snapshot.closeApproaches;
  if (sourceId === "jpl-sentry") return snapshot.impactRisks;
  return snapshot.spaceWeatherEvents;
}

export async function readOrbitalSnapshot(
  database: D1DocumentDatabase | undefined,
  config: OrbitalLiveConfiguration,
  options: { demoEnabled?: boolean; now?: Date } = {},
): Promise<OrbitalSnapshot> {
  const now = options.now ?? new Date();
  const demoEnabled = options.demoEnabled ?? true;
  const fixture = createDemoOrbitalSnapshot(now);
  let rows: OrbitalSourceSnapshotRow[] = [];
  if (database) {
    try {
      const result = await database.prepare(
        `SELECT source_id, status, payload, source_version, source_timestamp, record_count,
          last_attempt_at, last_successful_at, next_refresh_at, error_message
         FROM orbital_source_snapshots`,
      ).all<OrbitalSourceSnapshotRow>();
      rows = result.results ?? [];
    } catch {
      rows = [];
    }
  }
  const rowBySource = new Map(rows.map((row) => [row.source_id, row]));
  let earthOrbitObjects: EarthOrbitObject[] = [];
  let closeApproaches: CloseApproach[] = [];
  let impactRisks: ImpactRiskRecord[] = [];
  let spaceWeatherEvents: SpaceWeatherEvent[] = [];
  let usedFixture = false;
  let usedPublic = false;

  for (const definition of SOURCE_DEFINITIONS) {
    const row = rowBySource.get(definition.id);
    const decoded = row?.last_successful_at ? decodeArray<never>(row.payload) : null;
    const values = decoded ?? (demoEnabled ? fixtureRecordsFor(fixture, definition.id) : []);
    if (decoded) usedPublic = true;
    else if (demoEnabled && values.length) usedFixture = true;
    if (definition.id === "celestrak-stations") earthOrbitObjects = values as EarthOrbitObject[];
    else if (definition.id === "jpl-close-approaches") closeApproaches = values as CloseApproach[];
    else if (definition.id === "jpl-sentry") impactRisks = values as ImpactRiskRecord[];
    else spaceWeatherEvents = values as SpaceWeatherEvent[];
  }

  const sources = SOURCE_DEFINITIONS.map((definition) => {
    const row = rowBySource.get(definition.id);
    if (!row?.last_successful_at && demoEnabled) {
      const fixtureSource = fixture.sources.find((candidate) => candidate.id === definition.id);
      if (fixtureSource) {
        return {
          ...fixtureSource,
          message: `${publicStatus(definition, row, config, now).message} Showing fictional fallback records.`,
        };
      }
    }
    return publicStatus(definition, row, config, now);
  });

  return {
    generatedAt: now.toISOString(),
    dataClassification: usedPublic && usedFixture
      ? "mixed"
      : usedPublic || !usedFixture
        ? "public-information"
        : "demonstration",
    demoDataLabel: usedPublic && usedFixture
      ? "Mixed public-information snapshots and demonstration fallback — inspect each source"
      : usedPublic
        ? "Public orbital information — positions may be propagated or modeled"
        : demoEnabled
          ? ORBITAL_DEMONSTRATION_LABEL
          : "No orbital source data available",
    earthOrbitObjects,
    closeApproaches,
    impactRisks,
    spaceWeatherEvents,
    sources,
  };
}
