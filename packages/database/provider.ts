import {
  demoBriefs,
  demoEvents,
  demoReports,
  demoSources,
  demoWatchlists,
} from "@/packages/shared/demo-data";
import type {
  IntelligenceBrief,
  IntelligenceDataProvider,
  IntelligenceEvent,
  IntelligenceSource,
  SourceReport,
  WatchlistEntry,
} from "@/packages/shared/types";

export interface MockProviderDataset {
  events: readonly IntelligenceEvent[];
  reports: readonly SourceReport[];
  briefs: readonly IntelligenceBrief[];
  watchlists: readonly WatchlistEntry[];
  sources: readonly IntelligenceSource[];
}

const DEFAULT_DATASET: MockProviderDataset = {
  events: demoEvents,
  reports: demoReports,
  briefs: demoBriefs,
  watchlists: demoWatchlists,
  sources: demoSources,
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
}

export function createMockIntelligenceDataProvider(
  dataset: MockProviderDataset = DEFAULT_DATASET,
): IntelligenceDataProvider {
  return new MockIntelligenceDataProvider(dataset);
}

export const intelligenceDataProvider: IntelligenceDataProvider =
  createMockIntelligenceDataProvider();
