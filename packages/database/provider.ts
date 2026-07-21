import {
  demoBriefs,
  demoEvents,
  demoReports,
  demoSources,
  demoWatchlists,
} from "@/packages/shared/demo-data";
import {
  demoAlerts,
  demoCameraSources,
  demoConflictProfiles,
  demoGraphNodes,
  demoMarketAssets,
  demoMarketImpacts,
  demoMonitoringLayouts,
  demoRegionalProfiles,
  demoRelationshipHistory,
  demoRelationships,
  demoStateHistory,
} from "@/packages/shared/operations-demo-data";
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

export interface MockProviderDataset {
  events: readonly IntelligenceEvent[];
  reports: readonly SourceReport[];
  briefs: readonly IntelligenceBrief[];
  watchlists: readonly WatchlistEntry[];
  sources: readonly IntelligenceSource[];
  graphNodes: readonly IntelligenceGraphNode[];
  relationships: readonly IntelligenceRelationship[];
  relationshipHistory: readonly RelationshipHistoryEntry[];
  marketAssets: readonly MarketAsset[];
  marketImpacts: readonly MarketImpactAssessment[];
  conflictProfiles: readonly ConflictProfile[];
  regionalProfiles: readonly RegionalIntelligenceProfile[];
  stateHistory: readonly IntelligenceStateChange[];
  alerts: readonly IntelligenceAlert[];
  cameraSources: readonly PublicCameraSource[];
  monitoringLayouts: readonly MonitoringLayout[];
}

export const DEFAULT_DATASET: MockProviderDataset = {
  events: demoEvents,
  reports: demoReports,
  briefs: demoBriefs,
  watchlists: demoWatchlists,
  sources: demoSources,
  graphNodes: demoGraphNodes,
  relationships: demoRelationships,
  relationshipHistory: demoRelationshipHistory,
  marketAssets: demoMarketAssets,
  marketImpacts: demoMarketImpacts,
  conflictProfiles: demoConflictProfiles,
  regionalProfiles: demoRegionalProfiles,
  stateHistory: demoStateHistory,
  alerts: demoAlerts,
  cameraSources: demoCameraSources,
  monitoringLayouts: demoMonitoringLayouts,
};

export const EMPTY_DATASET: MockProviderDataset = {
  events: [],
  reports: [],
  briefs: [],
  watchlists: [],
  sources: [],
  graphNodes: [],
  relationships: [],
  relationshipHistory: [],
  marketAssets: [],
  marketImpacts: [],
  conflictProfiles: [],
  regionalProfiles: [],
  stateHistory: [],
  alerts: [],
  cameraSources: [],
  monitoringLayouts: [],
};

function copy<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Network-free provider used by the MVP and tests. Every read returns a copy so
 * UI experiments cannot mutate the canonical demonstration fixtures.
 */
export class MockIntelligenceDataProvider implements IntelligenceDataProvider {
  constructor(private readonly dataset: MockProviderDataset = DEFAULT_DATASET) {}

  async getEvents(): Promise<IntelligenceEvent[]> {
    return copy([...this.dataset.events]);
  }

  async getEventBySlug(slug: string): Promise<IntelligenceEvent | null> {
    const normalizedSlug = slug.trim().toLocaleLowerCase("en-US");
    const event = this.dataset.events.find(
      (candidate) => candidate.slug.toLocaleLowerCase("en-US") === normalizedSlug,
    );
    return event ? copy(event) : null;
  }

  async getReports(): Promise<SourceReport[]> {
    return copy([...this.dataset.reports]);
  }

  async getBriefs(): Promise<IntelligenceBrief[]> {
    return copy([...this.dataset.briefs]);
  }

  async getWatchlists(): Promise<WatchlistEntry[]> {
    return copy([...this.dataset.watchlists]);
  }

  async getSources(): Promise<IntelligenceSource[]> {
    return copy([...this.dataset.sources]);
  }

  async getGraphNodes(): Promise<IntelligenceGraphNode[]> {
    return copy([...this.dataset.graphNodes]);
  }

  async getRelationships(): Promise<IntelligenceRelationship[]> {
    return copy([...this.dataset.relationships]);
  }

  async getRelationshipHistory(): Promise<RelationshipHistoryEntry[]> {
    return copy([...this.dataset.relationshipHistory]);
  }

  async getMarketAssets(): Promise<MarketAsset[]> {
    return copy([...this.dataset.marketAssets]);
  }

  async getMarketImpacts(): Promise<MarketImpactAssessment[]> {
    return copy([...this.dataset.marketImpacts]);
  }

  async getConflictProfiles(): Promise<ConflictProfile[]> {
    return copy([...this.dataset.conflictProfiles]);
  }

  async getRegionalProfiles(): Promise<RegionalIntelligenceProfile[]> {
    return copy([...this.dataset.regionalProfiles]);
  }

  async getStateHistory(): Promise<IntelligenceStateChange[]> {
    return copy([...this.dataset.stateHistory]);
  }

  async getAlerts(): Promise<IntelligenceAlert[]> {
    return copy([...this.dataset.alerts]);
  }

  async getCameraSources(): Promise<PublicCameraSource[]> {
    return copy([...this.dataset.cameraSources]);
  }

  async getMonitoringLayouts(): Promise<MonitoringLayout[]> {
    return copy([...this.dataset.monitoringLayouts]);
  }
}

export function createMockIntelligenceDataProvider(
  dataset: MockProviderDataset = DEFAULT_DATASET,
): IntelligenceDataProvider {
  return new MockIntelligenceDataProvider(dataset);
}

let configuredProvider: IntelligenceDataProvider = createMockIntelligenceDataProvider();

/**
 * Stable delegating reference used by route modules. The Worker configures the
 * backing provider from its environment before dispatch; static builds and
 * tests retain the network-free fixture provider.
 */
export const intelligenceDataProvider: IntelligenceDataProvider = new Proxy(
  {} as IntelligenceDataProvider,
  {
    get(_target, property) {
      const value = configuredProvider[property as keyof IntelligenceDataProvider];
      return typeof value === "function" ? value.bind(configuredProvider) : value;
    },
  },
);

export function configureIntelligenceDataProvider(provider: IntelligenceDataProvider): void {
  configuredProvider = provider;
}

export function resetIntelligenceDataProvider(demoEnabled = true): void {
  configuredProvider = createMockIntelligenceDataProvider(demoEnabled ? DEFAULT_DATASET : EMPTY_DATASET);
}
