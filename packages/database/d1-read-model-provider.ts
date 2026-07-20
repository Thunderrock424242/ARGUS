import {
  DEFAULT_DATASET,
  MockIntelligenceDataProvider,
  type MockProviderDataset,
} from "@/packages/database/provider";
import type {
  ConflictProfile,
  IntelligenceAlert,
  IntelligenceBrief,
  IntelligenceDataProvider,
  IntelligenceEvent,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  IntelligenceSource,
  IntelligenceStateChange,
  MarketAsset,
  MarketImpactAssessment,
  MonitoringLayout,
  PublicCameraSource,
  RegionalIntelligenceProfile,
  RelationshipHistoryEntry,
  SourceReport,
  WatchlistEntry,
} from "@/packages/shared/types";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1DocumentDatabase {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

export const READ_MODEL_COLLECTIONS = {
  events: "events",
  reports: "reports",
  briefs: "briefs",
  watchlists: "watchlists",
  sources: "sources",
  graphNodes: "graph-nodes",
  relationships: "relationships",
  relationshipHistory: "relationship-history",
  marketAssets: "market-assets",
  marketImpacts: "market-impacts",
  conflictProfiles: "conflict-profiles",
  regionalProfiles: "regional-profiles",
  stateHistory: "state-history",
  alerts: "alerts",
  cameraSources: "camera-sources",
  monitoringLayouts: "monitoring-layouts",
} as const;

export type ReadModelCollection =
  (typeof READ_MODEL_COLLECTIONS)[keyof typeof READ_MODEL_COLLECTIONS];

interface ReadModelRow {
  document: string | Record<string, unknown>;
}

interface SeedRecord {
  id: string;
  slug?: string;
  updatedAt?: string;
  lastUpdatedAt?: string;
  lastRecalculatedAt?: string;
  calculatedAt?: string;
  collectedAt?: string;
  generatedAt?: string;
  occurredAt?: string;
  createdAt?: string;
  lastSuccessfulCheck?: string;
  dataClassification?: string;
}

function decodeDocument<T>(document: ReadModelRow["document"]): T {
  return structuredClone(
    (typeof document === "string" ? JSON.parse(document) : document) as T,
  );
}

function readModelId(collection: ReadModelCollection, recordId: string): string {
  return `${collection}:${recordId}`;
}

function recordTimestamp(record: SeedRecord): string {
  return (
    record.updatedAt ??
    record.lastUpdatedAt ??
    record.lastRecalculatedAt ??
    record.calculatedAt ??
    record.collectedAt ??
    record.generatedAt ??
    record.occurredAt ??
    record.createdAt ??
    record.lastSuccessfulCheck ??
    "2042-01-01T00:00:00.000Z"
  );
}

export function prepareReadModelUpsert(
  database: D1DocumentDatabase,
  collection: ReadModelCollection,
  record: SeedRecord,
  version = 1,
  sortOrder = 0,
): D1PreparedStatementLike {
  return database
    .prepare(
      `INSERT INTO intelligence_read_models (
        id, collection, record_id, slug, document, version, sort_order, updated_at, data_classification
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(collection, record_id) DO UPDATE SET
        slug = excluded.slug,
        document = excluded.document,
        version = MAX(intelligence_read_models.version + 1, excluded.version),
        updated_at = excluded.updated_at,
        data_classification = excluded.data_classification`,
    )
    .bind(
      readModelId(collection, record.id),
      collection,
      record.id,
      record.slug ?? null,
      JSON.stringify(record),
      version,
      sortOrder,
      recordTimestamp(record),
      record.dataClassification ?? "demonstration",
    );
}

export async function readModelById<T>(
  database: D1DocumentDatabase,
  collection: ReadModelCollection,
  recordId: string,
): Promise<T | null> {
  const row = await database
    .prepare(
      "SELECT document FROM intelligence_read_models WHERE collection = ? AND record_id = ? LIMIT 1",
    )
    .bind(collection, recordId)
    .first<ReadModelRow>();
  return row ? decodeDocument<T>(row.document) : null;
}

export async function readModelBySlug<T>(
  database: D1DocumentDatabase,
  collection: ReadModelCollection,
  slug: string,
): Promise<T | null> {
  const row = await database
    .prepare(
      "SELECT document FROM intelligence_read_models WHERE collection = ? AND slug = ? LIMIT 1",
    )
    .bind(collection, slug)
    .first<ReadModelRow>();
  return row ? decodeDocument<T>(row.document) : null;
}

export async function readModelCollection<T>(
  database: D1DocumentDatabase,
  collection: ReadModelCollection,
): Promise<T[]> {
  const result = await database
    .prepare(
      "SELECT document FROM intelligence_read_models WHERE collection = ? ORDER BY sort_order ASC, updated_at DESC, record_id ASC",
    )
    .bind(collection)
    .all<ReadModelRow>();
  return (result.results ?? []).map((row) => decodeDocument<T>(row.document));
}

const DATASET_COLLECTIONS: Array<{
  collection: ReadModelCollection;
  records: readonly SeedRecord[];
}> = [
  { collection: READ_MODEL_COLLECTIONS.events, records: DEFAULT_DATASET.events },
  { collection: READ_MODEL_COLLECTIONS.reports, records: DEFAULT_DATASET.reports },
  { collection: READ_MODEL_COLLECTIONS.briefs, records: DEFAULT_DATASET.briefs },
  { collection: READ_MODEL_COLLECTIONS.watchlists, records: DEFAULT_DATASET.watchlists },
  { collection: READ_MODEL_COLLECTIONS.sources, records: DEFAULT_DATASET.sources },
  { collection: READ_MODEL_COLLECTIONS.graphNodes, records: DEFAULT_DATASET.graphNodes },
  { collection: READ_MODEL_COLLECTIONS.relationships, records: DEFAULT_DATASET.relationships },
  { collection: READ_MODEL_COLLECTIONS.relationshipHistory, records: DEFAULT_DATASET.relationshipHistory },
  { collection: READ_MODEL_COLLECTIONS.marketAssets, records: DEFAULT_DATASET.marketAssets },
  { collection: READ_MODEL_COLLECTIONS.marketImpacts, records: DEFAULT_DATASET.marketImpacts },
  { collection: READ_MODEL_COLLECTIONS.conflictProfiles, records: DEFAULT_DATASET.conflictProfiles },
  { collection: READ_MODEL_COLLECTIONS.regionalProfiles, records: DEFAULT_DATASET.regionalProfiles },
  { collection: READ_MODEL_COLLECTIONS.stateHistory, records: DEFAULT_DATASET.stateHistory },
  { collection: READ_MODEL_COLLECTIONS.alerts, records: DEFAULT_DATASET.alerts },
  { collection: READ_MODEL_COLLECTIONS.cameraSources, records: DEFAULT_DATASET.cameraSources },
  { collection: READ_MODEL_COLLECTIONS.monitoringLayouts, records: DEFAULT_DATASET.monitoringLayouts },
];

export async function seedDemonstrationReadModels(
  database: D1DocumentDatabase,
): Promise<{ collections: number; records: number }> {
  const statements = DATASET_COLLECTIONS.flatMap(({ collection, records }) =>
    records.map((record, index) => prepareReadModelUpsert(database, collection, record, 1, index + 1)),
  );
  for (let index = 0; index < statements.length; index += 50) {
    await database.batch(statements.slice(index, index + 50));
  }
  return { collections: DATASET_COLLECTIONS.length, records: statements.length };
}

/**
 * D1-backed read provider with an explicit fixture fallback. A newly deployed
 * Worker remains usable before seeding, while any non-empty D1 collection is
 * treated as authoritative for that collection.
 */
export class D1IntelligenceDataProvider implements IntelligenceDataProvider {
  private readonly fallback: IntelligenceDataProvider;

  constructor(
    private readonly database: D1DocumentDatabase,
    fallbackDataset: MockProviderDataset = DEFAULT_DATASET,
  ) {
    this.fallback = new MockIntelligenceDataProvider(fallbackDataset);
  }

  private async collection<T>(
    collection: ReadModelCollection,
    fallback: () => Promise<T[]>,
  ): Promise<T[]> {
    try {
      const records = await readModelCollection<T>(this.database, collection);
      return records.length ? records : fallback();
    } catch {
      return fallback();
    }
  }

  async getEvents(): Promise<IntelligenceEvent[]> {
    return this.collection(READ_MODEL_COLLECTIONS.events, () => this.fallback.getEvents());
  }

  async getEventBySlug(slug: string): Promise<IntelligenceEvent | null> {
    try {
      const record = await readModelBySlug<IntelligenceEvent>(
        this.database,
        READ_MODEL_COLLECTIONS.events,
        slug,
      );
      return record ?? this.fallback.getEventBySlug(slug);
    } catch {
      return this.fallback.getEventBySlug(slug);
    }
  }

  async getReports(): Promise<SourceReport[]> {
    return this.collection(READ_MODEL_COLLECTIONS.reports, () => this.fallback.getReports());
  }

  async getBriefs(): Promise<IntelligenceBrief[]> {
    return this.collection(READ_MODEL_COLLECTIONS.briefs, () => this.fallback.getBriefs());
  }

  async getWatchlists(): Promise<WatchlistEntry[]> {
    return this.collection(READ_MODEL_COLLECTIONS.watchlists, () => this.fallback.getWatchlists());
  }

  async getSources(): Promise<IntelligenceSource[]> {
    return this.collection(READ_MODEL_COLLECTIONS.sources, () => this.fallback.getSources());
  }

  async getGraphNodes(): Promise<IntelligenceGraphNode[]> {
    return this.collection(READ_MODEL_COLLECTIONS.graphNodes, () => this.fallback.getGraphNodes());
  }

  async getRelationships(): Promise<IntelligenceRelationship[]> {
    return this.collection(READ_MODEL_COLLECTIONS.relationships, () => this.fallback.getRelationships());
  }

  async getRelationshipHistory(): Promise<RelationshipHistoryEntry[]> {
    return this.collection(READ_MODEL_COLLECTIONS.relationshipHistory, () => this.fallback.getRelationshipHistory());
  }

  async getMarketAssets(): Promise<MarketAsset[]> {
    return this.collection(READ_MODEL_COLLECTIONS.marketAssets, () => this.fallback.getMarketAssets());
  }

  async getMarketImpacts(): Promise<MarketImpactAssessment[]> {
    return this.collection(READ_MODEL_COLLECTIONS.marketImpacts, () => this.fallback.getMarketImpacts());
  }

  async getConflictProfiles(): Promise<ConflictProfile[]> {
    return this.collection(READ_MODEL_COLLECTIONS.conflictProfiles, () => this.fallback.getConflictProfiles());
  }

  async getRegionalProfiles(): Promise<RegionalIntelligenceProfile[]> {
    return this.collection(READ_MODEL_COLLECTIONS.regionalProfiles, () => this.fallback.getRegionalProfiles());
  }

  async getStateHistory(): Promise<IntelligenceStateChange[]> {
    return this.collection(READ_MODEL_COLLECTIONS.stateHistory, () => this.fallback.getStateHistory());
  }

  async getAlerts(): Promise<IntelligenceAlert[]> {
    return this.collection(READ_MODEL_COLLECTIONS.alerts, () => this.fallback.getAlerts());
  }

  async getCameraSources(): Promise<PublicCameraSource[]> {
    return this.collection(READ_MODEL_COLLECTIONS.cameraSources, () => this.fallback.getCameraSources());
  }

  async getMonitoringLayouts(): Promise<MonitoringLayout[]> {
    return this.collection(READ_MODEL_COLLECTIONS.monitoringLayouts, () => this.fallback.getMonitoringLayouts());
  }
}
