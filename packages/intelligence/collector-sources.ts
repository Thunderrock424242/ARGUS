import type { IntelligenceCollector, IntelligenceSource } from "@/packages/shared/types";
import {
  GuardianOpenPlatformCollector,
  UsgsEarthquakeCollector,
  XRecentSearchCollector,
  type CollectorTransport,
} from "./collectors";

export const PUBLIC_INFORMATION_LABEL =
  "Public information - unverified until explicit analyst review";

export type PilotCollectorId =
  | "usgs-earthquakes"
  | "guardian-open-platform"
  | "x-recent-search";

export interface CollectorPilotConfiguration {
  enabled: boolean;
  usgsEnabled: boolean;
  guardianEnabled: boolean;
  xEnabled: boolean;
  guardianQuery: string;
  xQuery: string;
  guardianApiKey?: string;
  xBearerToken?: string;
}

export interface CollectorPilotDefinition {
  collectorId: PilotCollectorId;
  source: IntelligenceSource;
  endpoint: string;
  requestedEnabled: boolean;
  active: boolean;
  credentialRequired: boolean;
  credentialConfigured: boolean;
  signalRole: "official" | "news" | "social";
  disabledReason?: string;
}

function boundedQuery(value: string, fallback: string, maximumLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return (normalized || fallback).slice(0, maximumLength);
}

function source(
  input: Omit<IntelligenceSource, "dataClassification" | "demoDataLabel">,
): IntelligenceSource {
  return {
    ...input,
    dataClassification: "public-information",
    demoDataLabel: PUBLIC_INFORMATION_LABEL,
  };
}

function disabledReason(
  config: CollectorPilotConfiguration,
  requestedEnabled: boolean,
  credentialRequired: boolean,
  credentialConfigured: boolean,
): string | undefined {
  if (!config.enabled) return "The collector pilot is globally disabled.";
  if (!requestedEnabled) return "This source is disabled in Worker configuration.";
  if (credentialRequired && !credentialConfigured) return "The required Worker secret is missing.";
  return undefined;
}

export function collectorPilotDefinitions(
  config: CollectorPilotConfiguration,
): CollectorPilotDefinition[] {
  const guardianQuery = boundedQuery(config.guardianQuery, "world", 200);
  const xQuery = boundedQuery(
    config.xQuery,
    "(earthquake OR wildfire OR cyclone OR flood) lang:en -is:retweet",
    512,
  );
  const guardianEndpoint = new URL("https://content.guardianapis.com/search");
  guardianEndpoint.searchParams.set("q", guardianQuery);
  guardianEndpoint.searchParams.set("order-by", "newest");
  guardianEndpoint.searchParams.set("page-size", "25");
  guardianEndpoint.searchParams.set("show-fields", "trailText,byline");

  const xEndpoint = new URL("https://api.x.com/2/tweets/search/recent");
  xEndpoint.searchParams.set("query", xQuery);
  xEndpoint.searchParams.set("max_results", "25");
  xEndpoint.searchParams.set("tweet.fields", "created_at,lang,author_id");
  xEndpoint.searchParams.set("expansions", "author_id");
  xEndpoint.searchParams.set("user.fields", "username");

  const records: Array<Omit<CollectorPilotDefinition, "active" | "disabledReason">> = [
    {
      collectorId: "usgs-earthquakes",
      endpoint: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
      requestedEnabled: config.usgsEnabled,
      credentialRequired: false,
      credentialConfigured: true,
      signalRole: "official",
      source: source({
        id: "source-usgs-earthquake-feed",
        name: "USGS Earthquake Hazards Program",
        organization: "U.S. Geological Survey",
        type: "api",
        url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
        categories: ["disaster", "environment"],
        reliabilityScore: 95,
        independenceGroup: "usgs-official-seismic",
        limitations: "Automated preliminary event parameters can be revised; a feed item is not an impact assessment.",
        enabled: false,
        status: "paused",
        recentFailureCount: 0,
        reportsCollected: 0,
        attributionRequirements: "Attribute earthquake parameters to the U.S. Geological Survey and preserve the event link.",
        schedule: { label: "Every 15 minutes", intervalMinutes: 15, timezone: "UTC" },
        rateLimitPerMinute: 4,
      }),
    },
    {
      collectorId: "guardian-open-platform",
      endpoint: guardianEndpoint.toString(),
      requestedEnabled: config.guardianEnabled,
      credentialRequired: true,
      credentialConfigured: Boolean(config.guardianApiKey),
      signalRole: "news",
      source: source({
        id: "source-guardian-open-platform",
        name: "The Guardian Open Platform",
        organization: "Guardian News & Media",
        type: "api",
        url: "https://open-platform.theguardian.com/",
        categories: ["political", "conflict", "economic", "disaster"],
        reliabilityScore: 78,
        independenceGroup: "guardian-newsroom",
        limitations: "A single newsroom is not independent corroboration. This adapter stores metadata and excerpts, not article bodies.",
        enabled: false,
        status: "paused",
        recentFailureCount: 0,
        reportsCollected: 0,
        attributionRequirements: "Preserve The Guardian article link, title, byline, publication time, and Open Platform usage terms.",
        schedule: { label: "Every 30 minutes", intervalMinutes: 30, timezone: "UTC" },
        rateLimitPerMinute: 1,
      }),
    },
    {
      collectorId: "x-recent-search",
      endpoint: xEndpoint.toString(),
      requestedEnabled: config.xEnabled,
      credentialRequired: true,
      credentialConfigured: Boolean(config.xBearerToken),
      signalRole: "social",
      source: source({
        id: "source-x-recent-search",
        name: "X recent public Post search",
        organization: "X Corp.",
        type: "api",
        url: "https://docs.x.com/x-api/posts/search/quickstart/recent-search",
        categories: ["other"],
        reliabilityScore: 35,
        independenceGroup: "x-public-posts",
        limitations: "Posts are unverified social signals, can be edited or deleted, and must never establish a fact without independent sources. X API reads are pay-per-use.",
        enabled: false,
        status: "paused",
        recentFailureCount: 0,
        reportsCollected: 0,
        attributionRequirements: "Preserve the public Post URL and author handle; follow the X Developer Agreement and display requirements.",
        schedule: { label: "Every 30 minutes", intervalMinutes: 30, timezone: "UTC" },
        rateLimitPerMinute: 1,
      }),
    },
  ];

  return records.map((record) => {
    const reason = disabledReason(
      config,
      record.requestedEnabled,
      record.credentialRequired,
      record.credentialConfigured,
    );
    const active = reason === undefined;
    return {
      ...record,
      active,
      disabledReason: reason,
      source: {
        ...record.source,
        enabled: active,
        status: active ? "unknown" : "paused",
      },
    };
  });
}

export function collectorForPilotDefinition(
  definition: CollectorPilotDefinition,
  transport: CollectorTransport,
): IntelligenceCollector {
  const options = {
    mode: "live" as const,
    transport,
    endpoint: definition.endpoint,
    maximumReports: 25,
    timeoutMs: 10_000,
    maximumResponseBytes: 2_000_000,
  };
  if (definition.collectorId === "usgs-earthquakes") return new UsgsEarthquakeCollector(options);
  if (definition.collectorId === "guardian-open-platform") return new GuardianOpenPlatformCollector(options);
  return new XRecentSearchCollector(options);
}
