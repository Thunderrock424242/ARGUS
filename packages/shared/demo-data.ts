import type {
  AuditLogEntry,
  BriefSection,
  ClaimStatus,
  CollectorRun,
  ConfidenceAssessment,
  ConfidenceFactor,
  ConfidenceLabel,
  EventCategory,
  EventSeverity,
  EventStatus,
  EventTimelineEntry,
  IntelligenceBrief,
  IntelligenceClaim,
  IntelligenceDataProvider,
  IntelligenceEvent,
  IntelligenceSource,
  PlatformMetrics,
  SourceReport,
  VerificationState,
  WatchlistEntry,
} from "./types";

export const DEMONSTRATION_DATA_LABEL =
  "Demonstration data — not real-world intelligence";

export const DEMONSTRATION_DATA_NOTICE =
  "All people, places, organizations, incidents, identifiers, and assessments in this dataset are fictional and exist only to demonstrate ARGUS workflows.";

const DATA_CLASSIFICATION = "demonstration" as const;
const SCENARIO_DATE = "2042-03-14";

function withDemoSource(
  source: Omit<
    IntelligenceSource,
    "dataClassification" | "demoDataLabel"
  >,
): IntelligenceSource {
  return {
    ...source,
    dataClassification: DATA_CLASSIFICATION,
    demoDataLabel: DEMONSTRATION_DATA_LABEL,
  };
}

export const demoSources: IntelligenceSource[] = [
  withDemoSource({
    id: "src-geological",
    name: "ARGUS Demo Geological Survey",
    organization: "Fictional Northstar Geoscience Office",
    type: "api",
    url: "https://geology.argus-demo.example/api/events",
    region: "Global",
    categories: ["disaster", "environment"],
    reliabilityScore: 96,
    independenceGroup: "demo-government-science",
    limitations: "Synthetic structured measurements; no connection to a real geological agency.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:28:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:27:42Z`,
    recentFailureCount: 0,
    reportsCollected: 418,
    attributionRequirements: "Label as fictional ARGUS demonstration data.",
    schedule: { label: "Every 5 minutes", intervalMinutes: 5, cron: "*/5 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 30,
  }),
  withDemoSource({
    id: "src-volcanic",
    name: "ARGUS Demo Volcanic Ash Center",
    organization: "Fictional Calder Aviation Observatory",
    type: "rss",
    url: "https://volcano.argus-demo.example/advisories.xml",
    region: "Global",
    categories: ["aviation", "environment", "disaster"],
    reliabilityScore: 94,
    independenceGroup: "demo-aviation-observatory",
    limitations: "Scenario advisories are generated for interface testing only.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:25:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:25:03Z`,
    recentFailureCount: 0,
    reportsCollected: 137,
    attributionRequirements: "Retain fictional center name and demonstration label.",
    schedule: { label: "Every 10 minutes", intervalMinutes: 10, cron: "*/10 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 12,
  }),
  withDemoSource({
    id: "src-emergency",
    name: "ARGUS Demo Emergency Coordination Feed",
    organization: "Fictional Interregional Response Secretariat",
    type: "atom",
    url: "https://response.argus-demo.example/alerts.atom",
    region: "Global",
    categories: ["disaster", "health", "local", "infrastructure"],
    reliabilityScore: 91,
    independenceGroup: "demo-emergency-authority",
    limitations: "Exercise notifications may lag simulated local authority records.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:24:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:24:08Z`,
    recentFailureCount: 0,
    reportsCollected: 305,
    attributionRequirements: "Preserve exercise identifier and demonstration notice.",
    schedule: { label: "Every 5 minutes", intervalMinutes: 5, cron: "*/5 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 20,
  }),
  withDemoSource({
    id: "src-cyber",
    name: "ARGUS Demo Cybersecurity Center",
    organization: "Fictional Public Cyber Defense Bureau",
    type: "api",
    url: "https://cyber.argus-demo.example/v1/advisories",
    region: "Global",
    categories: ["cyber", "technology", "infrastructure"],
    reliabilityScore: 95,
    independenceGroup: "demo-cyber-authority",
    limitations: "Uses invented vulnerabilities and threat groups only.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:20:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:20:11Z`,
    recentFailureCount: 0,
    reportsCollected: 522,
    attributionRequirements: "Do not map demonstration identifiers to real vulnerabilities.",
    schedule: { label: "Every 15 minutes", intervalMinutes: 15, cron: "*/15 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 20,
  }),
  withDemoSource({
    id: "src-maritime",
    name: "ARGUS Demo Maritime Authority",
    organization: "Fictional Pelagic Navigation Office",
    type: "webhook",
    url: "https://maritime.argus-demo.example/notices/webhook",
    region: "Maritime regions",
    categories: ["maritime", "environment", "infrastructure"],
    reliabilityScore: 93,
    independenceGroup: "demo-maritime-authority",
    limitations: "Navigational notices refer to fictional ports and waterways.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:26:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:26:19Z`,
    recentFailureCount: 0,
    reportsCollected: 246,
    attributionRequirements: "Attribute to the fictional Pelagic Navigation Office.",
    schedule: { label: "Webhook with 10-minute health check", intervalMinutes: 10, cron: "*/10 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 60,
  }),
  withDemoSource({
    id: "src-humanitarian",
    name: "ARGUS Demo Humanitarian Exchange",
    organization: "Fictional Haven Relief Network",
    type: "api",
    url: "https://relief.argus-demo.example/api/updates",
    region: "Global",
    categories: ["conflict", "disaster", "health"],
    reliabilityScore: 88,
    independenceGroup: "demo-humanitarian-network",
    limitations: "Access and impact figures are simulated and may be revised.",
    enabled: true,
    status: "degraded",
    lastCheckedAt: `${SCENARIO_DATE}T14:15:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T13:15:09Z`,
    recentFailureCount: 1,
    reportsCollected: 189,
    attributionRequirements: "Retain fictional provider attribution and update timestamp.",
    schedule: { label: "Hourly", intervalMinutes: 60, cron: "7 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 10,
  }),
  withDemoSource({
    id: "src-weather",
    name: "ARGUS Demo Weather Service",
    organization: "Fictional Meridian Atmospheric Service",
    type: "api",
    url: "https://weather.argus-demo.example/alerts",
    region: "Global",
    categories: ["disaster", "environment", "aviation"],
    reliabilityScore: 95,
    independenceGroup: "demo-weather-authority",
    limitations: "Forecasts and warnings are synthetic exercise products.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:25:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:25:16Z`,
    recentFailureCount: 0,
    reportsCollected: 607,
    attributionRequirements: "Display issue time and demonstration notice.",
    schedule: { label: "Every 5 minutes", intervalMinutes: 5, cron: "*/5 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 30,
  }),
  withDemoSource({
    id: "src-environment",
    name: "ARGUS Demo Environmental Sensor Network",
    organization: "Fictional Azure Research Consortium",
    type: "dataset",
    url: "https://environment.argus-demo.example/datasets/observations.json",
    region: "Global",
    categories: ["environment", "disaster", "health"],
    reliabilityScore: 89,
    independenceGroup: "demo-academic-sensors",
    limitations: "Synthetic sensors can contain calibration gaps by design.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:10:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:10:29Z`,
    recentFailureCount: 0,
    reportsCollected: 342,
    attributionRequirements: "Cite the fictional Azure Research Consortium dataset.",
    schedule: { label: "Every 30 minutes", intervalMinutes: 30, cron: "10,40 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 8,
  }),
  withDemoSource({
    id: "src-health",
    name: "ARGUS Demo Public Health Agency",
    organization: "Fictional Solace Health Directorate",
    type: "rss",
    url: "https://health.argus-demo.example/bulletins.xml",
    region: "Global",
    categories: ["health", "local", "environment"],
    reliabilityScore: 92,
    independenceGroup: "demo-health-authority",
    limitations: "All health advisories and case counts are fictional.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:00:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:00:06Z`,
    recentFailureCount: 0,
    reportsCollected: 178,
    attributionRequirements: "Include fictional bulletin number and demonstration label.",
    schedule: { label: "Hourly", intervalMinutes: 60, cron: "0 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 12,
  }),
  withDemoSource({
    id: "src-aviation",
    name: "ARGUS Demo Aviation Safety Board",
    organization: "Fictional Aerilon Flight Safety Office",
    type: "api",
    url: "https://aviation.argus-demo.example/api/notices",
    region: "Global",
    categories: ["aviation", "technology", "infrastructure"],
    reliabilityScore: 94,
    independenceGroup: "demo-aviation-authority",
    limitations: "Aircraft, airports, and notices are invented.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:22:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:22:10Z`,
    recentFailureCount: 0,
    reportsCollected: 211,
    attributionRequirements: "Preserve synthetic notice identifier.",
    schedule: { label: "Every 15 minutes", intervalMinutes: 15, cron: "*/15 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 20,
  }),
  withDemoSource({
    id: "src-infrastructure",
    name: "ARGUS Demo Infrastructure Monitor",
    organization: "Fictional Continuity Systems Laboratory",
    type: "dataset",
    url: "https://infrastructure.argus-demo.example/status.json",
    region: "Global",
    categories: ["infrastructure", "technology", "economic"],
    reliabilityScore: 87,
    independenceGroup: "demo-infrastructure-research",
    limitations: "Aggregated synthetic telemetry omits asset-level operational details.",
    enabled: true,
    status: "degraded",
    lastCheckedAt: `${SCENARIO_DATE}T14:20:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:05:21Z`,
    recentFailureCount: 2,
    reportsCollected: 393,
    attributionRequirements: "Describe values as synthetic aggregate telemetry.",
    schedule: { label: "Every 15 minutes", intervalMinutes: 15, cron: "5,20,35,50 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 10,
  }),
  withDemoSource({
    id: "src-economic",
    name: "ARGUS Demo Economic Bulletin",
    organization: "Fictional Aster Monetary Forum",
    type: "rss",
    url: "https://economy.argus-demo.example/bulletins.rss",
    region: "Global",
    categories: ["economic", "political", "infrastructure"],
    reliabilityScore: 85,
    independenceGroup: "demo-economic-institute",
    limitations: "Scenario market and settlement figures are not investment information.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:00:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:00:18Z`,
    recentFailureCount: 0,
    reportsCollected: 155,
    attributionRequirements: "Identify figures as fictional scenario data.",
    schedule: { label: "Hourly", intervalMinutes: 60, cron: "0 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 12,
  }),
  withDemoSource({
    id: "src-regional-news",
    name: "ARGUS Demo Regional News Cooperative",
    organization: "Fictional Open Meridian Press Cooperative",
    type: "rss",
    url: "https://news.argus-demo.example/world.rss",
    region: "Global",
    categories: ["conflict", "political", "crime", "local", "economic"],
    reliabilityScore: 76,
    independenceGroup: "demo-regional-news",
    limitations: "Fictional secondary reporting; verify against primary records.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:15:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:15:34Z`,
    recentFailureCount: 0,
    reportsCollected: 481,
    attributionRequirements: "Link to the fictional cooperative item.",
    schedule: { label: "Every 15 minutes", intervalMinutes: 15, cron: "*/15 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 18,
  }),
  withDemoSource({
    id: "src-wire",
    name: "ARGUS Demo Wire Syndicate",
    organization: "Fictional Horizon Wire Service",
    type: "atom",
    url: "https://wire.argus-demo.example/feed.atom",
    region: "Global",
    categories: ["other", "political", "economic", "disaster", "conflict"],
    reliabilityScore: 72,
    independenceGroup: "demo-wire-syndication",
    limitations: "Frequently republishes partner copy and must not count as independent corroboration.",
    enabled: true,
    status: "online",
    lastCheckedAt: `${SCENARIO_DATE}T14:15:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T14:15:41Z`,
    recentFailureCount: 0,
    reportsCollected: 512,
    attributionRequirements: "Retain originating partner attribution when present.",
    schedule: { label: "Every 15 minutes", intervalMinutes: 15, cron: "*/15 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 20,
  }),
  withDemoSource({
    id: "src-community",
    name: "ARGUS Demo Community Verification Feed",
    organization: "Fictional Civic Signal Lab",
    type: "webhook",
    url: "https://community.argus-demo.example/signals/webhook",
    region: "Global",
    categories: ["local", "crime", "conflict", "disaster"],
    reliabilityScore: 46,
    independenceGroup: "demo-community-observers",
    limitations: "Unverified observer submissions require independent confirmation.",
    enabled: false,
    status: "paused",
    lastCheckedAt: `${SCENARIO_DATE}T12:00:00Z`,
    lastSuccessfulCollectionAt: `${SCENARIO_DATE}T11:44:13Z`,
    recentFailureCount: 0,
    reportsCollected: 93,
    attributionRequirements: "Do not identify fictional individual contributors.",
    schedule: { label: "Webhook with 10-minute health check", intervalMinutes: 10, cron: "*/10 * * * *", timezone: "UTC" },
    rateLimitPerMinute: 40,
  }),
];

function withDemoWatchlist(
  watchlist: Omit<WatchlistEntry, "dataClassification" | "demoDataLabel">,
): WatchlistEntry {
  return {
    ...watchlist,
    dataClassification: DATA_CLASSIFICATION,
    demoDataLabel: DEMONSTRATION_DATA_LABEL,
  };
}

const watchlistDates = {
  createdAt: "2042-02-01T12:00:00Z",
  updatedAt: `${SCENARIO_DATE}T12:00:00Z`,
};

export const demoWatchlists: WatchlistEntry[] = [
  withDemoWatchlist({
    id: "watch-seismic",
    name: "[DEMO] Northstar seismic activity",
    type: "geographic-area",
    matchRules: [{ field: "coordinates", operator: "within-radius", value: { latitude: -21.2, longitude: 168.7, radiusKm: 900 } }],
    priority: "high",
    enabled: true,
    notificationSettings: { inApp: true, email: false, minimumSeverity: 3, minimumConfidence: 60, digest: "immediate" },
    lastMatchAt: `${SCENARIO_DATE}T13:54:00Z`,
    matchCount: 7,
    matchedEventIds: ["evt-001", "evt-002"],
    notes: "Fictional exercise area only.",
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-port-meridian",
    name: "[DEMO] Port Meridian operations",
    type: "city",
    matchRules: [{ field: "title", operator: "contains", value: "Port Meridian" }],
    priority: "critical",
    enabled: true,
    notificationSettings: { inApp: true, email: true, minimumSeverity: 2, minimumConfidence: 40, digest: "immediate" },
    lastMatchAt: `${SCENARIO_DATE}T13:38:00Z`,
    matchCount: 12,
    matchedEventIds: ["evt-004", "evt-007", "evt-008"],
    notes: "Includes navigational and environmental indicators.",
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-ardent-corridor",
    name: "[DEMO] Ardent Corridor stability",
    type: "region",
    matchRules: [{ field: "tags", operator: "contains", value: "ardent-corridor" }],
    priority: "critical",
    enabled: true,
    notificationSettings: { inApp: true, email: true, minimumSeverity: 3, minimumConfidence: 35, digest: "immediate" },
    lastMatchAt: `${SCENARIO_DATE}T13:10:00Z`,
    matchCount: 9,
    matchedEventIds: ["evt-009", "evt-020"],
    notes: "Contradictory reporting should always enter analyst review.",
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-cyber-infrastructure",
    name: "[DEMO] Critical infrastructure cyber",
    type: "event-category",
    matchRules: [
      { field: "category", operator: "equals", value: "cyber" },
      { field: "tags", operator: "contains", value: "critical-infrastructure" },
    ],
    priority: "high",
    enabled: true,
    notificationSettings: { inApp: true, email: false, minimumSeverity: 3, minimumConfidence: 50, digest: "hourly" },
    lastMatchAt: `${SCENARIO_DATE}T13:46:00Z`,
    matchCount: 16,
    matchedEventIds: ["evt-003", "evt-013"],
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-vulnerability",
    name: "[DEMO] CVE-DEMO-2042-0042",
    type: "vulnerability",
    matchRules: [{ field: "tags", operator: "contains", value: "CVE-DEMO-2042-0042" }],
    priority: "critical",
    enabled: true,
    notificationSettings: { inApp: true, email: true, minimumSeverity: 1, minimumConfidence: 25, digest: "immediate" },
    lastMatchAt: `${SCENARIO_DATE}T13:46:00Z`,
    matchCount: 4,
    matchedEventIds: ["evt-013"],
    notes: "Synthetic identifier; not a real vulnerability.",
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-aster-continuity",
    name: "[DEMO] Aster financial continuity",
    type: "country",
    matchRules: [{ field: "country", operator: "equals", value: "Aster Federation" }],
    priority: "high",
    enabled: true,
    notificationSettings: { inApp: true, email: false, minimumSeverity: 2, minimumConfidence: 40, digest: "hourly" },
    lastMatchAt: `${SCENARIO_DATE}T12:52:00Z`,
    matchCount: 10,
    matchedEventIds: ["evt-018", "evt-019"],
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-wildfire",
    name: "[DEMO] Ember Ridge wildfire",
    type: "keyword",
    matchRules: [{ field: "tags", operator: "contains", value: "wildfire" }],
    priority: "high",
    enabled: true,
    notificationSettings: { inApp: true, email: false, minimumSeverity: 3, minimumConfidence: 60, digest: "immediate" },
    lastMatchAt: `${SCENARIO_DATE}T12:35:00Z`,
    matchCount: 5,
    matchedEventIds: ["evt-017"],
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-pelagic-cable",
    name: "[DEMO] Pelagic cable routes",
    type: "geographic-area",
    matchRules: [{ field: "tags", operator: "contains", value: "undersea-cable" }],
    priority: "high",
    enabled: true,
    notificationSettings: { inApp: true, email: false, minimumSeverity: 2, minimumConfidence: 55, digest: "hourly" },
    lastMatchAt: `${SCENARIO_DATE}T12:31:00Z`,
    matchCount: 6,
    matchedEventIds: ["evt-006", "evt-015"],
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-novaair",
    name: "[DEMO] NovaAir fleet",
    type: "aircraft",
    matchRules: [{ field: "entity", operator: "equals", value: "NovaAir" }],
    priority: "medium",
    enabled: true,
    notificationSettings: { inApp: true, email: false, minimumSeverity: 2, minimumConfidence: 50, digest: "daily" },
    lastMatchAt: `${SCENARIO_DATE}T12:06:00Z`,
    matchCount: 3,
    matchedEventIds: ["evt-012"],
    ...watchlistDates,
  }),
  withDemoWatchlist({
    id: "watch-public-health",
    name: "[DEMO] Public health advisories",
    type: "event-category",
    matchRules: [{ field: "category", operator: "equals", value: "health" }],
    priority: "medium",
    enabled: true,
    notificationSettings: { inApp: true, email: false, minimumSeverity: 2, minimumConfidence: 45, digest: "daily" },
    lastMatchAt: `${SCENARIO_DATE}T11:42:00Z`,
    matchCount: 8,
    matchedEventIds: ["evt-011", "evt-023"],
    ...watchlistDates,
  }),
];

interface EventSeed {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: EventCategory;
  status: EventStatus;
  severity: EventSeverity;
  confidence: number;
  verificationState: VerificationState;
  countryCode: string;
  countryName: string;
  region: string;
  locationName: string;
  latitude: number;
  longitude: number;
  tags: string[];
  sourceIds: [string, string, string];
  fact: string;
  unverified: string;
  disputed?: string;
  watchlistIds: string[];
  relatedEventIds?: string[];
  possibleDuplicateOfEventIds?: string[];
  entityIds: string[];
  officialSourceCount: number;
  reviewRequired?: boolean;
  priority?: boolean;
  reviewerName?: string;
  analystNotes?: string;
}

const eventSeeds: EventSeed[] = [
  {
    id: "evt-001", slug: "demo-northstar-island-earthquake", title: "[DEMO] Strong earthquake detected near Northstar Island",
    summary: "Fictional exercise: structured sensors indicate a shallow offshore earthquake near the invented Northstar Island chain.",
    category: "disaster", status: "active", severity: 4, confidence: 92, verificationState: "analyst-confirmed",
    countryCode: "XZ", countryName: "Northstar Territory", region: "Oceania", locationName: "Northstar Island Shelf", latitude: -21.2, longitude: 168.7,
    tags: ["fictional-scenario", "earthquake", "offshore", "structured-data"], sourceIds: ["src-geological", "src-emergency", "src-regional-news"],
    fact: "Synthetic seismic instruments registered a magnitude 6.7 exercise signal.", unverified: "Minor facade damage is reported in the fictional town of Lattice Bay.",
    watchlistIds: ["watch-seismic"], relatedEventIds: ["evt-002"], entityIds: ["ent-northstar", "ent-lattice-bay"], officialSourceCount: 2, priority: true, reviewerName: "Mason",
    analystNotes: "Confirmed as a demonstration event using two independent synthetic structured feeds.",
  },
  {
    id: "evt-002", slug: "demo-mount-calder-ash-advisory", title: "[DEMO] Ash advisory issued for Mount Calder airspace",
    summary: "Fictional exercise: a simulated ash plume has prompted a precautionary aviation advisory around Mount Calder.",
    category: "aviation", status: "developing", severity: 3, confidence: 74, verificationState: "needs-review",
    countryCode: "XC", countryName: "Calder Republic", region: "Latin America", locationName: "Mount Calder", latitude: -8.3, longitude: -76.4,
    tags: ["fictional-scenario", "volcanic-ash", "aviation", "advisory"], sourceIds: ["src-volcanic", "src-aviation", "src-wire"],
    fact: "A synthetic volcanic ash advisory was issued for the Mount Calder flight information region.", unverified: "The plume may reach the upper boundary of a second fictional flight corridor.",
    watchlistIds: ["watch-seismic"], relatedEventIds: ["evt-001"], entityIds: ["ent-mount-calder", "ent-calder-fir"], officialSourceCount: 2, reviewRequired: true, priority: true,
  },
  {
    id: "evt-003", slug: "demo-helios-municipal-ransomware", title: "[DEMO] Helios municipal network isolates affected services",
    summary: "Fictional exercise: the invented city of Helios isolated administrative systems after a simulated ransomware alert.",
    category: "cyber", status: "active", severity: 4, confidence: 88, verificationState: "analyst-confirmed",
    countryCode: "XH", countryName: "Helian Union", region: "Europe", locationName: "Helios City", latitude: 48.4, longitude: 17.6,
    tags: ["fictional-scenario", "ransomware", "municipal", "critical-infrastructure"], sourceIds: ["src-cyber", "src-infrastructure", "src-regional-news"],
    fact: "The fictional Helios administration isolated three synthetic network segments.", unverified: "A community post claims archival records were exfiltrated before isolation.",
    watchlistIds: ["watch-cyber-infrastructure"], relatedEventIds: ["evt-013"], entityIds: ["ent-helios-city", "ent-glass-comet"], officialSourceCount: 1, priority: true, reviewerName: "Mason",
    analystNotes: "Operational disruption is corroborated; data-exfiltration claims remain unverified.",
  },
  {
    id: "evt-004", slug: "demo-port-meridian-lane-closure", title: "[DEMO] Port Meridian closes eastern shipping lane",
    summary: "Fictional exercise: Port Meridian temporarily closed an eastern approach after synthetic navigation telemetry reported a submerged obstruction.",
    category: "maritime", status: "stable", severity: 3, confidence: 81, verificationState: "automated",
    countryCode: "XM", countryName: "Meridian Commonwealth", region: "Maritime regions", locationName: "Port Meridian", latitude: 35.8, longitude: 14.2,
    tags: ["fictional-scenario", "shipping", "navigation", "port-meridian"], sourceIds: ["src-maritime", "src-infrastructure", "src-regional-news"],
    fact: "The fictional port authority issued a lane-closure notice with a synthetic navigation identifier.", unverified: "The obstruction may be a lost construction pontoon.",
    watchlistIds: ["watch-port-meridian"], relatedEventIds: ["evt-007", "evt-008"], entityIds: ["ent-port-meridian"], officialSourceCount: 1,
  },
  {
    id: "evt-005", slug: "demo-lumen-valley-flash-flooding", title: "[DEMO] Flash flooding affects Lumen Valley crossings",
    summary: "Fictional exercise: intense simulated rainfall has inundated road crossings in the invented Lumen Valley district.",
    category: "disaster", status: "active", severity: 4, confidence: 91, verificationState: "analyst-confirmed",
    countryCode: "XL", countryName: "Lumen Federation", region: "South Asia", locationName: "Lumen Valley", latitude: 27.1, longitude: 87.4,
    tags: ["fictional-scenario", "flash-flood", "transport", "weather"], sourceIds: ["src-weather", "src-emergency", "src-humanitarian"],
    fact: "Four fictional valley crossings were closed under an exercise emergency order.", unverified: "A rural clinic may be operating on backup power.",
    watchlistIds: [], entityIds: ["ent-lumen-valley"], officialSourceCount: 2, priority: true, reviewerName: "Mason",
  },
  {
    id: "evt-006", slug: "demo-arcturus-satellite-communications-outage", title: "[DEMO] Arcturus corridor reports satellite communications outage",
    summary: "Fictional exercise: intermittent synthetic satellite links are affecting research stations across the Arcturus corridor.",
    category: "infrastructure", status: "developing", severity: 3, confidence: 68, verificationState: "needs-review",
    countryCode: "XA", countryName: "Arcturus Research Zone", region: "Arctic", locationName: "Arcturus Corridor", latitude: 78.2, longitude: 23.6,
    tags: ["fictional-scenario", "satellite", "communications", "critical-infrastructure"], sourceIds: ["src-infrastructure", "src-emergency", "src-regional-news"],
    fact: "Two fictional research stations reported loss of their primary satellite link.", unverified: "A shared ground-segment fault may connect the outages.",
    watchlistIds: ["watch-pelagic-cable"], relatedEventIds: ["evt-015"], entityIds: ["ent-arcturus-stations"], officialSourceCount: 1, reviewRequired: true,
  },
  {
    id: "evt-007", slug: "demo-port-meridian-fuel-sheen", title: "[DEMO] Fuel sheen observed in Port Meridian outer harbor",
    summary: "Fictional exercise: synthetic harbor observations indicate a limited fuel sheen near the outer breakwater.",
    category: "environment", status: "developing", severity: 2, confidence: 62, verificationState: "needs-review",
    countryCode: "XM", countryName: "Meridian Commonwealth", region: "Europe", locationName: "Port Meridian Outer Harbor", latitude: 35.83, longitude: 14.28,
    tags: ["fictional-scenario", "pollution", "fuel", "port-meridian"], sourceIds: ["src-environment", "src-maritime", "src-community"],
    fact: "A fictional harbor sensor recorded a hydrocarbon signature near the breakwater.", unverified: "The release may have originated from a service vessel.",
    watchlistIds: ["watch-port-meridian"], relatedEventIds: ["evt-004", "evt-008"], possibleDuplicateOfEventIds: ["evt-008"], entityIds: ["ent-port-meridian"], officialSourceCount: 1, reviewRequired: true,
  },
  {
    id: "evt-008", slug: "demo-meridian-outer-harbor-water-advisory", title: "[DEMO] Meridian issues outer-harbor water-quality advisory",
    summary: "Fictional exercise: a water-quality notice may describe the same synthetic harbor incident tracked in another ARGUS event.",
    category: "environment", status: "disputed", severity: 2, confidence: 39, verificationState: "needs-review",
    countryCode: "XM", countryName: "Meridian Commonwealth", region: "Europe", locationName: "Port Meridian Outer Harbor", latitude: 35.82, longitude: 14.27,
    tags: ["fictional-scenario", "water-quality", "port-meridian", "possible-duplicate"], sourceIds: ["src-regional-news", "src-environment", "src-wire"],
    fact: "A fictional precautionary water-contact advisory was published.", unverified: "The advisory may refer to the fuel sheen already recorded as EVT-007.",
    watchlistIds: ["watch-port-meridian"], relatedEventIds: ["evt-004", "evt-007"], possibleDuplicateOfEventIds: ["evt-007"], entityIds: ["ent-port-meridian"], officialSourceCount: 0, reviewRequired: true,
  },
  {
    id: "evt-009", slug: "demo-ardent-corridor-ceasefire-report", title: "[DEMO] Conflicting reports of ceasefire violation in Ardent Corridor",
    summary: "Fictional exercise: two synthetic reports disagree about whether an exchange occurred inside the invented monitoring zone.",
    category: "conflict", status: "disputed", severity: 5, confidence: 46, verificationState: "disputed",
    countryCode: "XR", countryName: "Ardent Compact Zone", region: "Middle East", locationName: "Ardent Corridor", latitude: 32.1, longitude: 36.8,
    tags: ["fictional-scenario", "ardent-corridor", "ceasefire", "contradiction"], sourceIds: ["src-humanitarian", "src-regional-news", "src-community"],
    fact: "Fictional monitoring teams acknowledged receiving an incident allegation.", unverified: "Observers reported two brief flashes near a marked buffer boundary.",
    disputed: "One synthetic report attributes the flashes to an exchange; another states they were scheduled demolition activity.",
    watchlistIds: ["watch-ardent-corridor"], relatedEventIds: ["evt-020"], entityIds: ["ent-ardent-monitoring-mission"], officialSourceCount: 0, reviewRequired: true, priority: true,
  },
  {
    id: "evt-010", slug: "demo-veridian-grid-frequency-instability", title: "[DEMO] Veridian grid reports regional frequency instability",
    summary: "Fictional exercise: synthetic grid telemetry shows a short-lived frequency deviation in Veridian Province.",
    category: "infrastructure", status: "stable", severity: 3, confidence: 84, verificationState: "analyst-confirmed",
    countryCode: "XV", countryName: "Veridian Republic", region: "Africa", locationName: "Veridian Province", latitude: -2.2, longitude: 29.4,
    tags: ["fictional-scenario", "power-grid", "energy", "critical-infrastructure"], sourceIds: ["src-infrastructure", "src-emergency", "src-regional-news"],
    fact: "Synthetic grid telemetry recorded an eight-minute exercise frequency deviation.", unverified: "A generating-unit trip may have initiated the imbalance.",
    watchlistIds: [], relatedEventIds: ["evt-018"], entityIds: ["ent-veridian-grid"], officialSourceCount: 1, reviewerName: "Mason",
  },
  {
    id: "evt-011", slug: "demo-solace-basin-crop-blight-alert", title: "[DEMO] Solace Basin crop-blight alert withdrawn",
    summary: "Fictional exercise: an early automated crop-health alert was rejected after synthetic calibration records showed sensor drift.",
    category: "health", status: "rejected", severity: 1, confidence: 22, verificationState: "analyst-rejected",
    countryCode: "XS", countryName: "Solace Republic", region: "Africa", locationName: "Solace Basin", latitude: 8.6, longitude: 22.9,
    tags: ["fictional-scenario", "agriculture", "sensor-error", "rejected"], sourceIds: ["src-environment", "src-health", "src-regional-news"],
    fact: "The fictional sensor network issued an automated vegetation-stress alert.", unverified: "The initial alert described a possible crop pathogen.",
    watchlistIds: ["watch-public-health"], entityIds: ["ent-solace-basin"], officialSourceCount: 1, reviewerName: "Mason",
    analystNotes: "Rejected: simulated calibration drift explains the signal; no independent evidence of crop disease.",
  },
  {
    id: "evt-012", slug: "demo-novaair-avionics-inspection", title: "[DEMO] NovaAir begins precautionary avionics inspection",
    summary: "Fictional exercise: the invented carrier NovaAir is inspecting a subset of aircraft after a synthetic maintenance trend alert.",
    category: "aviation", status: "stable", severity: 2, confidence: 78, verificationState: "analyst-confirmed",
    countryCode: "XN", countryName: "Novara Union", region: "North America", locationName: "NovaAir Technical Center", latitude: 42.7, longitude: -78.1,
    tags: ["fictional-scenario", "NovaAir", "avionics", "inspection"], sourceIds: ["src-aviation", "src-infrastructure", "src-wire"],
    fact: "NovaAir issued a fictional precautionary inspection order covering twelve training-scenario aircraft.", unverified: "Three scheduled services may be consolidated during inspections.",
    watchlistIds: ["watch-novaair"], relatedEventIds: ["evt-022"], entityIds: ["ent-novaair"], officialSourceCount: 1, reviewerName: "Mason",
  },
  {
    id: "evt-013", slug: "demo-cve-2042-0042-exploitation", title: "[DEMO] Exploitation observed for fictional CVE-DEMO-2042-0042",
    summary: "Fictional exercise: controlled telemetry indicates exploitation of an invented vulnerability in exposed gateway appliances.",
    category: "cyber", status: "active", severity: 5, confidence: 94, verificationState: "analyst-confirmed",
    countryCode: "XX", countryName: "Multiple fictional jurisdictions", region: "Global", locationName: "Distributed synthetic sensor network", latitude: 18.0, longitude: 4.0,
    tags: ["fictional-scenario", "CVE-DEMO-2042-0042", "exploitation", "critical-infrastructure"], sourceIds: ["src-cyber", "src-infrastructure", "src-regional-news"],
    fact: "The fictional cyber center added CVE-DEMO-2042-0042 to its simulated exploitation catalog.", unverified: "The exercise actor Glass Comet may be responsible for all observed attempts.",
    watchlistIds: ["watch-cyber-infrastructure", "watch-vulnerability"], relatedEventIds: ["evt-003"], entityIds: ["ent-cve-demo-2042-0042", "ent-glass-comet"], officialSourceCount: 1, priority: true, reviewerName: "Mason",
  },
  {
    id: "evt-014", slug: "demo-bellweather-transit-disruption", title: "[DEMO] Bellweather transit disruption reports conflict",
    summary: "Fictional exercise: reporting disagrees on whether a transit shutdown followed a protest or a scheduled signal-system test.",
    category: "political", status: "disputed", severity: 3, confidence: 58, verificationState: "disputed",
    countryCode: "XB", countryName: "Bellweather State", region: "Europe", locationName: "Bellweather City", latitude: 50.2, longitude: 10.3,
    tags: ["fictional-scenario", "protest", "transit", "contradiction"], sourceIds: ["src-regional-news", "src-infrastructure", "src-community"],
    fact: "Three fictional central transit stations closed for forty-two minutes.", unverified: "A demonstration may have delayed reopening at one station.",
    disputed: "Synthetic operator logs describe a planned signal test, while observer reports describe an unplanned protest-related closure.",
    watchlistIds: [], entityIds: ["ent-bellweather-transit"], officialSourceCount: 0, reviewRequired: true,
  },
  {
    id: "evt-015", slug: "demo-pelagic-undersea-cable-degradation", title: "[DEMO] Pelagic Reach cable route shows degraded capacity",
    summary: "Fictional exercise: aggregate synthetic telemetry indicates reduced capacity on one undersea cable route in Pelagic Reach.",
    category: "infrastructure", status: "developing", severity: 3, confidence: 76, verificationState: "automated",
    countryCode: "XP", countryName: "Pelagic Administrative Zone", region: "Maritime regions", locationName: "Pelagic Reach", latitude: -4.3, longitude: 72.8,
    tags: ["fictional-scenario", "undersea-cable", "telecommunications", "maritime"], sourceIds: ["src-infrastructure", "src-maritime", "src-economic"],
    fact: "Synthetic network telemetry shows a 38 percent capacity reduction on the PR-7 route.", unverified: "A subsea repeater fault may explain the degradation.",
    watchlistIds: ["watch-pelagic-cable"], relatedEventIds: ["evt-006"], entityIds: ["ent-pr7-cable"], officialSourceCount: 1,
  },
  {
    id: "evt-016", slug: "demo-orison-industrial-spill", title: "[DEMO] Orison industrial zone reports contained chemical spill",
    summary: "Fictional exercise: an invented industrial facility reports a contained release and precautionary shelter guidance.",
    category: "disaster", status: "developing", severity: 4, confidence: 66, verificationState: "needs-review",
    countryCode: "XO", countryName: "Orison Republic", region: "East Asia", locationName: "Orison Industrial Zone", latitude: 34.1, longitude: 129.8,
    tags: ["fictional-scenario", "chemical-spill", "shelter-guidance", "industrial"], sourceIds: ["src-emergency", "src-environment", "src-community"],
    fact: "A fictional facility alarm and emergency bulletin both record a chemical release.", unverified: "The release may have crossed the facility's northern boundary before containment.",
    watchlistIds: [], relatedEventIds: ["evt-023"], entityIds: ["ent-orison-industrial-zone"], officialSourceCount: 1, reviewRequired: true, priority: true,
  },
  {
    id: "evt-017", slug: "demo-ember-ridge-wildfire-evacuation", title: "[DEMO] Ember Ridge wildfire triggers precautionary evacuation",
    summary: "Fictional exercise: a simulated wildfire has prompted evacuation of two invented rural sectors near Ember Ridge.",
    category: "environment", status: "active", severity: 4, confidence: 89, verificationState: "analyst-confirmed",
    countryCode: "XE", countryName: "Emberland Province", region: "North America", locationName: "Ember Ridge", latitude: 46.2, longitude: -113.7,
    tags: ["fictional-scenario", "wildfire", "evacuation", "weather"], sourceIds: ["src-weather", "src-emergency", "src-environment"],
    fact: "Fictional emergency authorities ordered evacuation of Sectors Pine-4 and Pine-5.", unverified: "Wind could shift the exercise fire perimeter toward a transmission corridor.",
    watchlistIds: ["watch-wildfire"], relatedEventIds: ["evt-021"], entityIds: ["ent-ember-ridge"], officialSourceCount: 2, priority: true, reviewerName: "Mason",
  },
  {
    id: "evt-018", slug: "demo-aster-settlement-delay", title: "[DEMO] Aster banks report delayed settlement window",
    summary: "Fictional exercise: several invented banks report delayed interbank settlement after a synthetic processing fault.",
    category: "economic", status: "developing", severity: 3, confidence: 71, verificationState: "needs-review",
    countryCode: "XT", countryName: "Aster Federation", region: "East Asia", locationName: "Aster Financial District", latitude: 37.3, longitude: 127.2,
    tags: ["fictional-scenario", "banking", "settlement", "Aster"], sourceIds: ["src-economic", "src-infrastructure", "src-regional-news"],
    fact: "The fictional clearing operator extended its settlement window by ninety minutes.", unverified: "Customer transfers may be delayed into the next simulated business cycle.",
    watchlistIds: ["watch-aster-continuity"], relatedEventIds: ["evt-010", "evt-019"], possibleDuplicateOfEventIds: ["evt-019"], entityIds: ["ent-aster-clearing"], officialSourceCount: 0, reviewRequired: true,
  },
  {
    id: "evt-019", slug: "demo-aster-clearing-network-latency", title: "[DEMO] Aster clearing network latency reported separately",
    summary: "Fictional exercise: a second event may describe the same synthetic settlement disruption already tracked by ARGUS.",
    category: "technology", status: "emerging", severity: 2, confidence: 43, verificationState: "needs-review",
    countryCode: "XT", countryName: "Aster Federation", region: "East Asia", locationName: "Aster Financial District", latitude: 37.31, longitude: 127.19,
    tags: ["fictional-scenario", "network-latency", "Aster", "possible-duplicate"], sourceIds: ["src-regional-news", "src-infrastructure", "src-wire"],
    fact: "Synthetic monitoring shows latency on the fictional Aster clearing gateway.", unverified: "The latency and settlement delay may share one underlying processing fault.",
    watchlistIds: ["watch-aster-continuity"], relatedEventIds: ["evt-018"], possibleDuplicateOfEventIds: ["evt-018"], entityIds: ["ent-aster-clearing"], officialSourceCount: 0, reviewRequired: true,
  },
  {
    id: "evt-020", slug: "demo-haven-humanitarian-corridor-delay", title: "[DEMO] Haven District aid corridor opening delayed",
    summary: "Fictional exercise: a planned humanitarian corridor in the invented Haven District opened later than scheduled.",
    category: "conflict", status: "developing", severity: 4, confidence: 64, verificationState: "needs-review",
    countryCode: "XR", countryName: "Ardent Compact Zone", region: "Middle East", locationName: "Haven District", latitude: 31.8, longitude: 36.4,
    tags: ["fictional-scenario", "ardent-corridor", "humanitarian", "access"], sourceIds: ["src-humanitarian", "src-regional-news", "src-wire"],
    fact: "A fictional relief convoy remained at Checkpoint Iris beyond its scheduled opening time.", unverified: "Additional inspection requirements may have caused the delay.",
    watchlistIds: ["watch-ardent-corridor"], relatedEventIds: ["evt-009"], entityIds: ["ent-haven-relief-network"], officialSourceCount: 0, reviewRequired: true, priority: true,
  },
  {
    id: "evt-021", slug: "demo-azure-atoll-coral-sensor-alert", title: "[DEMO] Azure Atoll sensors indicate coral heat stress",
    summary: "Fictional exercise: synthetic marine sensors show sustained thermal stress around the invented Azure Atoll reef.",
    category: "environment", status: "developing", severity: 2, confidence: 82, verificationState: "automated",
    countryCode: "XU", countryName: "Azure Atoll Territory", region: "Oceania", locationName: "Azure Atoll", latitude: -15.7, longitude: -150.2,
    tags: ["fictional-scenario", "coral", "ocean-temperature", "sensor"], sourceIds: ["src-environment", "src-weather", "src-regional-news"],
    fact: "Synthetic reef sensors recorded seven consecutive days above the exercise heat-stress threshold.", unverified: "Visible bleaching may extend beyond the monitored eastern transect.",
    watchlistIds: [], relatedEventIds: ["evt-017"], entityIds: ["ent-azure-atoll"], officialSourceCount: 1,
  },
  {
    id: "evt-022", slug: "demo-aerilon-airport-drone-sighting", title: "[DEMO] Aerilon Airport drone-sighting reports remain disputed",
    summary: "Fictional exercise: observer reports and synthetic radar logs disagree about an object near the invented Aerilon Airport.",
    category: "aviation", status: "disputed", severity: 4, confidence: 51, verificationState: "disputed",
    countryCode: "XH", countryName: "Helian Union", region: "Europe", locationName: "Aerilon Airport", latitude: 49.0, longitude: 18.2,
    tags: ["fictional-scenario", "drone", "airport", "contradiction"], sourceIds: ["src-aviation", "src-regional-news", "src-community"],
    fact: "The fictional airport briefly suspended one departure sequence.", unverified: "Two observers described a small illuminated object north of the runway.",
    disputed: "Synthetic primary radar shows no corresponding track during the observer-reported interval.",
    watchlistIds: [], relatedEventIds: ["evt-012"], entityIds: ["ent-aerilon-airport"], officialSourceCount: 1, reviewRequired: true, priority: true,
  },
  {
    id: "evt-023", slug: "demo-cedar-ward-boil-water-advisory", title: "[DEMO] Cedar Ward issues boil-water advisory",
    summary: "Fictional exercise: a pressure-loss incident triggered a precautionary water advisory in the invented Cedar Ward.",
    category: "local", status: "active", severity: 2, confidence: 86, verificationState: "analyst-confirmed",
    countryCode: "XN", countryName: "Novara Union", region: "North America", locationName: "Cedar Ward", latitude: 40.4, longitude: -86.2,
    tags: ["fictional-scenario", "water", "public-health", "local-advisory"], sourceIds: ["src-health", "src-emergency", "src-regional-news"],
    fact: "A fictional utility issued a precautionary boil-water advisory after a synthetic pressure loss.", unverified: "Approximately 1,400 scenario households may be inside the affected zone.",
    watchlistIds: ["watch-public-health"], relatedEventIds: ["evt-016"], entityIds: ["ent-cedar-utility"], officialSourceCount: 2, reviewerName: "Mason",
  },
  {
    id: "evt-024", slug: "demo-northrail-freight-derailment", title: "[DEMO] Northrail freight derailment blocks remote route",
    summary: "Fictional exercise: three empty training-scenario freight cars derailed on a remote Northrail segment without reported injuries.",
    category: "infrastructure", status: "stable", severity: 2, confidence: 80, verificationState: "analyst-confirmed",
    countryCode: "XA", countryName: "Arcturus Research Zone", region: "Arctic", locationName: "Northrail Kilometer 284", latitude: 67.9, longitude: 41.5,
    tags: ["fictional-scenario", "rail", "freight", "transport"], sourceIds: ["src-infrastructure", "src-emergency", "src-wire"],
    fact: "Three fictional empty freight cars left the rail on the Northrail route.", unverified: "The remote segment may remain blocked for twelve exercise hours.",
    watchlistIds: [], entityIds: ["ent-northrail"], officialSourceCount: 1, reviewerName: "Mason",
  },
];

const duplicateReportEventIds = new Set([
  "evt-004",
  "evt-008",
  "evt-012",
  "evt-016",
  "evt-021",
  "evt-024",
]);

const pendingReportEventIds = new Set([
  "evt-002",
  "evt-006",
  "evt-018",
  "evt-020",
  "evt-023",
]);

function timestampForEvent(eventIndex: number, minuteOffset = 0): string {
  const anchor = Date.UTC(2042, 2, 14, 14, 0, 0);
  return new Date(anchor - eventIndex * 19 * 60_000 + minuteOffset * 60_000).toISOString();
}

function reportId(eventId: string, ordinal: number): string {
  return `rpt-${eventId.slice(4)}-${String(ordinal).padStart(2, "0")}`;
}

function cleanEventTitle(title: string): string {
  return title.replace(/^\[DEMO\]\s*/, "");
}

export const demoReports: SourceReport[] = eventSeeds.flatMap(
  (seed, eventIndex) =>
    seed.sourceIds.map((sourceId, reportIndex): SourceReport => {
      const ordinal = reportIndex + 1;
      const id = reportId(seed.id, ordinal);
      const isDuplicate =
        duplicateReportEventIds.has(seed.id) && reportIndex === 2;
      const isPending =
        pendingReportEventIds.has(seed.id) && reportIndex === 2;
      const isContradiction = Boolean(seed.disputed) && reportIndex === 2;
      const duplicateOfReportId = isDuplicate
        ? reportId(seed.id, 2)
        : undefined;
      const externalId = isDuplicate
        ? `DEMO-${seed.id}-02`
        : `DEMO-${seed.id}-${String(ordinal).padStart(2, "0")}`;
      const sourceTitle = cleanEventTitle(seed.title);
      const title = isDuplicate
        ? `[DEMO DUPLICATE] Republished: ${sourceTitle}`
        : isContradiction
          ? `[DEMO SOURCE] Contradicting account: ${sourceTitle}`
          : isPending
            ? `[DEMO SOURCE] Awaiting processing: ${sourceTitle}`
            : reportIndex === 0
              ? `[DEMO SOURCE] Initial notice: ${sourceTitle}`
              : reportIndex === 1
                ? `[DEMO SOURCE] Corroborating update: ${sourceTitle}`
                : `[DEMO SOURCE] Follow-up: ${sourceTitle}`;
      const description = isDuplicate
        ? `Fictional syndicated copy of ${duplicateOfReportId}; it must not count as independent corroboration.`
        : isContradiction
          ? seed.disputed
          : isPending
            ? "Fictional report queued for normalization and association review."
            : reportIndex === 0
              ? seed.fact
              : reportIndex === 1
                ? seed.unverified
                : `Fictional follow-up for ${sourceTitle}.`;
      const contentHash = isDuplicate
        ? `demo-hash-${seed.id}-02`
        : `demo-hash-${seed.id}-${String(ordinal).padStart(2, "0")}`;

      return {
        id,
        sourceId,
        eventId: seed.id,
        externalId,
        url: `https://reports.argus-demo.example/${seed.slug}/${ordinal}`,
        normalizedUrl: `https://reports.argus-demo.example/${seed.slug}/${ordinal}`,
        title,
        description,
        bodyText: `${DEMONSTRATION_DATA_NOTICE} ${description}`,
        author: "Fictional exercise desk",
        language: "en",
        publishedAt: timestampForEvent(eventIndex, reportIndex * 8),
        collectedAt: timestampForEvent(eventIndex, reportIndex * 8 + 2),
        latitude: seed.latitude,
        longitude: seed.longitude,
        countryCode: seed.countryCode,
        category: seed.category,
        rawPayload: {
          demonstration: true,
          scenarioId: `ARGUS-DEMO-${seed.id}`,
          recordOrdinal: ordinal,
          intentionallyContradictory: isContradiction,
          intentionallyDuplicated: isDuplicate,
        },
        contentHash,
        processingStatus: isDuplicate
          ? "duplicate"
          : isPending
            ? "pending"
            : "processed",
        duplicateOfReportId,
        dataClassification: DATA_CLASSIFICATION,
        demoDataLabel: DEMONSTRATION_DATA_LABEL,
      };
    }),
);

function confidenceLabelFor(score: number): ConfidenceLabel {
  if (score < 25) return "unverified";
  if (score < 50) return "low";
  if (score < 70) return "moderate";
  if (score < 90) return "high";
  return "strongly-corroborated";
}

function makeFactor(
  seed: EventSeed,
  suffix: string,
  factor: Omit<ConfidenceFactor, "id">,
): ConfidenceFactor {
  return { id: `factor-${seed.id}-${suffix}`, ...factor };
}

function buildConfidenceAssessment(seed: EventSeed): ConfidenceAssessment {
  const reports = [reportId(seed.id, 1), reportId(seed.id, 2)];
  const positiveFactors: ConfidenceFactor[] = [
    makeFactor(seed, "independent", {
      code: "independent-sources",
      label: "Independent evidence",
      description: "At least two reports belong to separate fictional independence groups.",
      direction: "positive",
      weight: 18,
      appliedScore: 18,
      reportIds: reports,
    }),
    makeFactor(seed, "spatiotemporal", {
      code: "time-location-match",
      label: "Time and location alignment",
      description: "The linked reports identify a compatible exercise time window and location.",
      direction: "positive",
      weight: 14,
      appliedScore: 14,
      reportIds: reports,
    }),
    makeFactor(seed, "reliability", {
      code: "source-reliability",
      label: "Source track record",
      description: "Available fictional source metadata meets the configured reliability threshold.",
      direction: "positive",
      weight: 12,
      appliedScore: Math.min(12, Math.max(4, Math.round(seed.confidence / 9))),
      reportIds: reports,
    }),
  ];

  if (seed.officialSourceCount > 0) {
    positiveFactors.push(
      makeFactor(seed, "official", {
        code: "official-source",
        label: "Official exercise source",
        description: `${seed.officialSourceCount} linked report source(s) are designated as fictional official authorities.`,
        direction: "positive",
        weight: 20,
        appliedScore: Math.min(20, 12 + seed.officialSourceCount * 4),
        reportIds: [reportId(seed.id, 1)],
      }),
    );
  }

  if (["disaster", "cyber", "environment", "infrastructure"].includes(seed.category)) {
    positiveFactors.push(
      makeFactor(seed, "structured", {
        code: "structured-evidence",
        label: "Structured evidence",
        description: "At least one linked demonstration record contains structured telemetry or alert metadata.",
        direction: "positive",
        weight: 12,
        appliedScore: 10,
        reportIds: [reportId(seed.id, 1)],
      }),
    );
  }

  const negativeFactors: ConfidenceFactor[] = [];
  if (seed.disputed) {
    negativeFactors.push(
      makeFactor(seed, "contradiction", {
        code: "major-contradiction",
        label: "Material contradiction",
        description: "A linked demonstration report conflicts with a central factual claim.",
        direction: "negative",
        weight: -24,
        appliedScore: -24,
        reportIds: [reportId(seed.id, 2), reportId(seed.id, 3)],
      }),
    );
  }
  if (seed.possibleDuplicateOfEventIds?.length) {
    negativeFactors.push(
      makeFactor(seed, "circular", {
        code: "circular-reporting",
        label: "Possible duplicate event",
        description: "Evidence may overlap another event and therefore may not be independent.",
        direction: "negative",
        weight: -16,
        appliedScore: -16,
        reportIds: [reportId(seed.id, 2), reportId(seed.id, 3)],
      }),
    );
  }
  if (seed.sourceIds.includes("src-community")) {
    negativeFactors.push(
      makeFactor(seed, "low-reliability", {
        code: "low-reliability-source",
        label: "Unverified observer source",
        description: "One linked exercise report comes from a low-reliability community feed.",
        direction: "negative",
        weight: -12,
        appliedScore: -10,
        reportIds: [reportId(seed.id, 3)],
      }),
    );
  }

  return {
    score: seed.confidence,
    label: confidenceLabelFor(seed.confidence),
    positiveFactors,
    negativeFactors,
    calculatedAt: timestampForEvent(eventSeeds.indexOf(seed), 32),
    modelVersion: "argus-rules-demo-1.0.0",
    explanation: `Automated confidence is ${seed.confidence}%, based on transparent ARGUS demonstration rules. It is an evidence-satisfaction score, not a probability or a declaration that the event is true.`,
  };
}

function makeClaim(
  seed: EventSeed,
  suffix: string,
  text: string,
  status: ClaimStatus,
  confidence: number,
  supportingReportIds: string[],
  contradictingReportIds: string[] = [],
): IntelligenceClaim {
  const eventIndex = eventSeeds.indexOf(seed);
  return {
    id: `claim-${seed.id}-${suffix}`,
    text,
    confidence,
    status,
    supportingReportIds,
    contradictingReportIds,
    createdAt: timestampForEvent(eventIndex, 5),
    updatedAt: timestampForEvent(eventIndex, 30),
  };
}

export const demoEvents: IntelligenceEvent[] = eventSeeds.map(
  (seed, eventIndex): IntelligenceEvent => {
    const sourceReportIds = [1, 2, 3].map((ordinal) =>
      reportId(seed.id, ordinal),
    );
    const factStatus: ClaimStatus =
      seed.verificationState === "analyst-confirmed" ||
      seed.verificationState === "analyst-rejected"
        ? "confirmed"
        : "corroborated";
    const confirmedFacts = [
      makeClaim(
        seed,
        "fact",
        seed.fact,
        factStatus,
        Math.min(99, Math.max(62, seed.confidence + 3)),
        [sourceReportIds[0], sourceReportIds[1]],
      ),
    ];
    const unverifiedClaims = [
      makeClaim(
        seed,
        "unverified",
        seed.unverified,
        "unverified",
        Math.min(68, Math.max(24, seed.confidence - 24)),
        [sourceReportIds[1]],
      ),
    ];
    const disputedClaims = seed.disputed
      ? [
          makeClaim(
            seed,
            "disputed",
            seed.disputed,
            "disputed",
            Math.min(58, seed.confidence),
            [sourceReportIds[1]],
            [sourceReportIds[2]],
          ),
        ]
      : [];
    const reviewRequired =
      seed.reviewRequired ??
      ["needs-review", "disputed"].includes(seed.verificationState);
    const hasNonSupportingThirdReport =
      duplicateReportEventIds.has(seed.id) ||
      pendingReportEventIds.has(seed.id);

    return {
      id: seed.id,
      slug: seed.slug,
      title: seed.title,
      summary: seed.summary,
      category: seed.category,
      status: seed.status,
      severity: seed.severity,
      automatedConfidence: seed.confidence,
      confidenceLabel: confidenceLabelFor(seed.confidence),
      confidenceAssessment: buildConfidenceAssessment(seed),
      verificationState: seed.verificationState,
      countryCode: seed.countryCode,
      countryName: seed.countryName,
      region: seed.region,
      locationName: seed.locationName,
      latitude: seed.latitude,
      longitude: seed.longitude,
      firstDetectedAt: timestampForEvent(eventIndex),
      lastUpdatedAt: timestampForEvent(eventIndex, 34),
      tags: seed.tags,
      confirmedFacts,
      unverifiedClaims,
      disputedClaims,
      relatedEventIds: seed.relatedEventIds ?? [],
      possibleDuplicateOfEventIds: seed.possibleDuplicateOfEventIds ?? [],
      sourceReportIds,
      entityIds: seed.entityIds,
      watchlistIds: seed.watchlistIds,
      officialSourceCount: seed.officialSourceCount,
      supportingSourceCount: hasNonSupportingThirdReport ? 2 : 3,
      contradictionCount: disputedClaims.length,
      reviewRequired,
      priority: seed.priority ?? seed.severity >= 4,
      analystNotes: seed.analystNotes,
      aetherAssessment: `Aether-generated demonstration analysis: ${seed.summary.replace("Fictional exercise: ", "")} Human review should focus on ${seed.disputed ? "the material contradiction" : seed.unverified.toLowerCase()}`,
      reviewedAt: seed.reviewerName
        ? timestampForEvent(eventIndex, 38)
        : undefined,
      reviewerName: seed.reviewerName,
      dataClassification: DATA_CLASSIFICATION,
      demoDataLabel: DEMONSTRATION_DATA_LABEL,
    };
  },
);

export const demoTimelineEntries: EventTimelineEntry[] = demoEvents.flatMap(
  (event): EventTimelineEntry[] => {
    const baseEntries: EventTimelineEntry[] = [
      {
        id: `timeline-${event.id}-detected`,
        eventId: event.id,
        type: "initial-detection",
        occurredAt: event.firstDetectedAt,
        title: "Initial demonstration signal detected",
        description: `ARGUS created ${event.id} from a fictional source report.`,
        reportIds: [event.sourceReportIds[0]],
        actor: "system",
        dataClassification: DATA_CLASSIFICATION,
      },
      {
        id: `timeline-${event.id}-report`,
        eventId: event.id,
        type: "report-added",
        occurredAt: demoReports.find(
          (report) => report.id === event.sourceReportIds[1],
        )?.collectedAt ?? event.lastUpdatedAt,
        title: "Additional fictional report associated",
        description: "A second demonstration source was correlated with the event.",
        reportIds: [event.sourceReportIds[1]],
        actor: "system",
        dataClassification: DATA_CLASSIFICATION,
      },
      {
        id: `timeline-${event.id}-confidence`,
        eventId: event.id,
        type: "confidence-change",
        occurredAt: event.confidenceAssessment.calculatedAt,
        title: `Automated confidence recalculated to ${event.automatedConfidence}%`,
        description: event.confidenceAssessment.explanation,
        reportIds: event.sourceReportIds,
        actor: "system",
        metadata: { score: event.automatedConfidence },
        dataClassification: DATA_CLASSIFICATION,
      },
    ];

    if (event.disputedClaims.length > 0) {
      baseEntries.push({
        id: `timeline-${event.id}-contradiction`,
        eventId: event.id,
        type: "contradiction",
        occurredAt: event.lastUpdatedAt,
        title: "Material contradiction detected",
        description: event.disputedClaims[0].text,
        reportIds: [event.sourceReportIds[1], event.sourceReportIds[2]],
        actor: "system",
        dataClassification: DATA_CLASSIFICATION,
      });
    }

    if (event.reviewerName) {
      baseEntries.push({
        id: `timeline-${event.id}-review`,
        eventId: event.id,
        type: "analyst-decision",
        occurredAt: event.reviewedAt ?? event.lastUpdatedAt,
        title:
          event.verificationState === "analyst-rejected"
            ? "Demonstration event rejected by analyst"
            : "Demonstration event confirmed by analyst",
        description:
          event.analystNotes ??
          "The analyst reviewed the fictional evidence and recorded a decision.",
        reportIds: event.sourceReportIds,
        actor: "analyst",
        dataClassification: DATA_CLASSIFICATION,
      });
    }

    return baseEntries;
  },
);

export const demoAuditEntries: AuditLogEntry[] = demoEvents
  .filter(
    (event) =>
      Boolean(event.reviewerName) ||
      event.verificationState === "disputed" ||
      event.possibleDuplicateOfEventIds.length > 0,
  )
  .map((event, index): AuditLogEntry => {
    const hasAnalyst = Boolean(event.reviewerName);
    const action = hasAnalyst
      ? event.verificationState === "analyst-rejected"
        ? "event-rejected"
        : "event-confirmed"
      : event.verificationState === "disputed"
        ? "event-disputed"
        : "evidence-requested";
    return {
      id: `audit-${String(index + 1).padStart(3, "0")}`,
      occurredAt: event.reviewedAt ?? event.lastUpdatedAt,
      actorId: hasAnalyst ? "analyst-mason" : "system-review-router",
      actorName: hasAnalyst ? (event.reviewerName ?? "Analyst") : "ARGUS review router",
      actorType: hasAnalyst ? "analyst" : "system",
      action,
      targetType: "event",
      targetId: event.id,
      summary: hasAnalyst
        ? `Recorded ${event.verificationState} for fictional demonstration event.`
        : event.verificationState === "disputed"
          ? "Routed fictional contradictory claims to the analyst queue."
          : "Requested evidence to resolve a possible duplicate event.",
      before: { verificationState: "automated" },
      after: {
        verificationState: event.verificationState,
        reviewRequired: event.reviewRequired,
      },
      reason:
        event.analystNotes ??
        "Demonstration audit entry generated from the scenario workflow.",
      correlationId: `demo-correlation-${event.id}`,
      dataClassification: DATA_CLASSIFICATION,
    };
  });

function briefSection(
  id: string,
  title: string,
  eventIds: string[],
  summary: string,
  items: string[],
): BriefSection {
  return { id, title, eventIds, summary, items };
}

function eventsForBrief(eventIds: string[]): IntelligenceEvent[] {
  return eventIds
    .map((id) => demoEvents.find((event) => event.id === id))
    .filter((event): event is IntelligenceEvent => Boolean(event));
}

function regionalBriefSections(
  briefId: string,
  events: IntelligenceEvent[],
): BriefSection[] {
  const regions = new Map<string, IntelligenceEvent[]>();
  for (const event of events) {
    const region = event.region ?? "Unspecified region";
    regions.set(region, [...(regions.get(region) ?? []), event]);
  }
  return [...regions.entries()].map(([region, regionalEvents], index) =>
    briefSection(
      `${briefId}-region-${index + 1}`,
      region,
      regionalEvents.map((event) => event.id),
      `${regionalEvents.length} fictional demonstration event${regionalEvents.length === 1 ? "" : "s"} tracked in ${region}.`,
      regionalEvents.map(
        (event) =>
          `${cleanEventTitle(event.title)} — automated confidence ${event.automatedConfidence}%.`,
      ),
    ),
  );
}

interface BriefSeed {
  id: string;
  slug: string;
  title: string;
  type: IntelligenceBrief["type"];
  status: IntelligenceBrief["status"];
  eventIds: string[];
  executiveSummary: string;
  collectionGaps: string[];
}

function createBrief(seed: BriefSeed, index: number): IntelligenceBrief {
  const events = eventsForBrief(seed.eventIds);
  const reviewEvents = events.filter((event) => event.reviewRequired);
  const disputedEvents = events.filter(
    (event) => event.disputedClaims.length > 0,
  );
  const resolvedEvents = events.filter((event) =>
    ["resolved", "rejected"].includes(event.status),
  );
  const watchlistEvents = events.filter(
    (event) => event.watchlistIds.length > 0,
  );
  const priorityEvents = [...events]
    .sort(
      (a, b) =>
        Number(b.priority) - Number(a.priority) ||
        b.severity - a.severity ||
        b.automatedConfidence - a.automatedConfidence,
    )
    .slice(0, 4);
  const generatedAt = new Date(
    Date.UTC(2042, 2, 14, 13 - index, 30, 0),
  ).toISOString();

  return {
    id: seed.id,
    slug: seed.slug,
    title: seed.title,
    type: seed.type,
    status: seed.status,
    periodStart:
      seed.type === "weekly"
        ? "2042-03-08T00:00:00Z"
        : "2042-03-14T00:00:00Z",
    periodEnd: "2042-03-14T23:59:59Z",
    generatedAt,
    generatedBy: "Aether",
    executiveSummary: `${DEMONSTRATION_DATA_LABEL}. ${seed.executiveSummary}`,
    priorityDevelopments: priorityEvents.map((event) => ({
      eventId: event.id,
      headline: cleanEventTitle(event.title),
      assessment: `Fictional exercise event at severity ${event.severity}; ${event.reviewRequired ? "analyst review remains required" : "current verification handling is complete"}.`,
      confidence: event.automatedConfidence,
    })),
    regionalDevelopments: regionalBriefSections(seed.id, events),
    watchlistActivity: [
      briefSection(
        `${seed.id}-watchlists`,
        "Watchlist activity",
        watchlistEvents.map((event) => event.id),
        `${watchlistEvents.length} included fictional events matched an enabled demonstration watchlist.`,
        watchlistEvents.length
          ? watchlistEvents.map(
              (event) =>
                `${cleanEventTitle(event.title)} matched ${event.watchlistIds.length} watchlist${event.watchlistIds.length === 1 ? "" : "s"}.`,
            )
          : ["No watchlist matches in this demonstration brief."],
      ),
    ],
    escalationRisks: [
      briefSection(
        `${seed.id}-risk`,
        "Escalation risks",
        events
          .filter((event) => event.severity >= 4)
          .map((event) => event.id),
        "Aether-generated demonstration assessment of events where impact could broaden.",
        events
          .filter((event) => event.severity >= 4)
          .map(
            (event) =>
              `${cleanEventTitle(event.title)} requires monitoring for simulated second-order effects.`,
          ),
      ),
    ],
    confidenceChanges: [
      briefSection(
        `${seed.id}-confidence`,
        "Confidence changes",
        events.map((event) => event.id),
        "Automated confidence remains an evidence-rule score, not a probability of truth.",
        events.slice(0, 5).map(
          (event) =>
            `${event.id}: ${event.automatedConfidence}% (${event.confidenceLabel}).`,
        ),
      ),
    ],
    disputedReporting: [
      briefSection(
        `${seed.id}-disputed`,
        "Disputed reporting",
        disputedEvents.map((event) => event.id),
        `${disputedEvents.length} included fictional event${disputedEvents.length === 1 ? " contains" : "s contain"} material contradictions.`,
        disputedEvents.length
          ? disputedEvents.map((event) => event.disputedClaims[0].text)
          : ["No material contradictions in this brief's selected demonstration events."],
      ),
    ],
    eventsRequiringReview: [
      briefSection(
        `${seed.id}-review`,
        "Events requiring analyst review",
        reviewEvents.map((event) => event.id),
        `${reviewEvents.length} selected fictional event${reviewEvents.length === 1 ? " is" : "s are"} in a review queue.`,
        reviewEvents.length
          ? reviewEvents.map(
              (event) =>
                `${event.id}: ${cleanEventTitle(event.title)} (${event.verificationState}).`,
            )
          : ["No selected demonstration events require review."],
      ),
    ],
    resolvedEvents: [
      briefSection(
        `${seed.id}-resolved`,
        "Resolved or rejected events",
        resolvedEvents.map((event) => event.id),
        `${resolvedEvents.length} selected event${resolvedEvents.length === 1 ? " has" : "s have"} a terminal workflow state.`,
        resolvedEvents.length
          ? resolvedEvents.map((event) => cleanEventTitle(event.title))
          : ["No selected demonstration events reached a terminal state."],
      ),
    ],
    collectionGaps: seed.collectionGaps,
    aetherAnalysis: `Aether-generated demonstration analysis: the selected fictional evidence shows ${priorityEvents.length} priority developments and ${reviewEvents.length} review items. This text is deterministic mock output and cites only local demonstration records.`,
    eventIds: events.map((event) => event.id),
    publishedAt: seed.status === "published" ? generatedAt : undefined,
    dataClassification: DATA_CLASSIFICATION,
    demoDataLabel: DEMONSTRATION_DATA_LABEL,
  };
}

const briefSeeds: BriefSeed[] = [
  {
    id: "brief-001",
    slug: "demo-daily-global-situation-2042-03-14",
    title: "[DEMO BRIEF] Daily global situation — 14 March 2042",
    type: "daily",
    status: "published",
    eventIds: ["evt-001", "evt-003", "evt-005", "evt-009", "evt-013", "evt-017", "evt-020", "evt-022"],
    executiveSummary: "The fictional scenario is led by a seismic response, critical cyber exploitation, wildfire evacuation, and unresolved contradiction cases.",
    collectionGaps: [
      "The fictional Ardent monitoring mission has not published structured incident coordinates.",
      "The Aerilon observer reports lack independently verifiable synthetic media.",
    ],
  },
  {
    id: "brief-002",
    slug: "demo-infrastructure-continuity-2042-03-14",
    title: "[DEMO BRIEF] Infrastructure continuity watch",
    type: "custom",
    status: "published",
    eventIds: ["evt-003", "evt-006", "evt-010", "evt-013", "evt-015", "evt-018", "evt-019", "evt-024"],
    executiveSummary: "Fictional infrastructure indicators show localized disruptions with no demonstrated common cause across regions.",
    collectionGaps: [
      "Synthetic Arcturus ground-segment telemetry is delayed.",
      "The Aster clearing operator has not yet linked network and settlement incident identifiers.",
    ],
  },
  {
    id: "brief-003",
    slug: "demo-weekly-horizon-2042-w11",
    title: "[DEMO BRIEF] Weekly horizon — scenario week 11",
    type: "weekly",
    status: "published",
    eventIds: demoEvents.map((event) => event.id),
    executiveSummary: "This fictional weekly horizon spans natural hazards, cyber activity, infrastructure continuity, maritime access, and analyst-review workload.",
    collectionGaps: [
      "Five demonstration reports remain pending in the local processing queue.",
      "The paused community feed cannot supply additional observer context.",
      "Possible duplicate pairs require analyst merge or separation decisions.",
    ],
  },
  {
    id: "brief-004",
    slug: "demo-contradiction-review-2042-03-14",
    title: "[DEMO BRIEF] Contradiction and review queue",
    type: "custom",
    status: "draft",
    eventIds: ["evt-007", "evt-008", "evt-009", "evt-014", "evt-018", "evt-019", "evt-022"],
    executiveSummary: "This deterministic mock brief isolates fictional contradictions and duplicate candidates for rapid human review.",
    collectionGaps: [
      "No additional fictional primary record is available for the Bellweather transit closure.",
      "The Meridian water advisory and fuel-sheen record need a shared synthetic incident identifier.",
    ],
  },
  {
    id: "brief-005",
    slug: "demo-hazards-environment-2042-03-14",
    title: "[DEMO BRIEF] Hazards and environment outlook",
    type: "daily",
    status: "published",
    eventIds: ["evt-001", "evt-002", "evt-005", "evt-007", "evt-008", "evt-016", "evt-017", "evt-021", "evt-023"],
    executiveSummary: "Fictional hazard activity is geographically dispersed; evacuation and public-safety messaging remain the principal operational themes.",
    collectionGaps: [
      "Synthetic imagery is unavailable for the Azure Atoll western transect.",
      "The Orison facility boundary sensor has not completed its exercise upload.",
    ],
  },
];

export const demoBriefs: IntelligenceBrief[] = briefSeeds.map(createBrief);

export const demoCollectorRuns: CollectorRun[] = demoSources
  .filter((source) => source.enabled)
  .map((source, index): CollectorRun => {
    const status = source.status === "degraded" ? "partial" : "succeeded";
    const reportsSeen = 7 + (index % 6);
    const duplicatesSkipped = index % 3;
    const rejectedCount = source.status === "degraded" ? 1 : 0;
    const startedAt = new Date(
      Date.UTC(2042, 2, 14, 14, 20 - index),
    ).toISOString();
    const completedAt = new Date(
      Date.parse(startedAt) + 1_200 + index * 173,
    ).toISOString();
    return {
      id: `run-${String(index + 1).padStart(3, "0")}`,
      collectorId: `collector-${source.id}`,
      sourceId: source.id,
      status,
      startedAt,
      completedAt,
      reportsSeen,
      reportsInserted: reportsSeen - duplicatesSkipped - rejectedCount,
      duplicatesSkipped,
      rejectedCount,
      retryCount: source.status === "degraded" ? 1 : 0,
      durationMs: Date.parse(completedAt) - Date.parse(startedAt),
      nextCursor: `demo-cursor-${index + 101}`,
      errorMessage:
        source.status === "degraded"
          ? "Fictional source returned one malformed demonstration record; valid records were retained."
          : undefined,
      requestId: `demo-request-${String(index + 1).padStart(3, "0")}`,
      dataClassification: DATA_CLASSIFICATION,
    };
  });

const dashboardRegions = [
  "North America",
  "Latin America",
  "Europe",
  "Middle East",
  "Africa",
  "South Asia",
  "East Asia",
  "Oceania",
  "Arctic",
  "Maritime regions",
];

export const demoMetrics: PlatformMetrics = {
  generatedAt: `${SCENARIO_DATE}T14:30:00Z`,
  activeEvents: demoEvents.filter((event) => event.status === "active").length,
  developingEvents: demoEvents.filter(
    (event) => event.status === "developing",
  ).length,
  criticalEvents: demoEvents.filter((event) => event.severity === 5).length,
  reportsCollectedToday: demoReports.length,
  reportsAwaitingProcessing: demoReports.filter((report) =>
    ["pending", "processing"].includes(report.processingStatus),
  ).length,
  eventsAwaitingReview: demoEvents.filter((event) => event.reviewRequired).length,
  contradictoryClaims: demoEvents.reduce(
    (count, event) => count + event.disputedClaims.length,
    0,
  ),
  sourcesOnline: demoSources.filter((source) => source.status === "online").length,
  sourcesTotal: demoSources.length,
  failedSources: demoSources.filter(
    (source) => source.status === "offline" || source.recentFailureCount > 0,
  ).length,
  processingBacklog: demoReports.filter((report) =>
    ["pending", "processing"].includes(report.processingStatus),
  ).length,
  averageApiResponseMs: 184,
  lastSuccessfulIngestionAt: `${SCENARIO_DATE}T14:27:42Z`,
  workerStatus: "operational",
  databaseStatus: "operational",
  regionalActivity: dashboardRegions.map((region, index) => {
    const events = demoEvents.filter((event) => event.region === region);
    return {
      region,
      activeEvents: events.filter((event) =>
        ["emerging", "developing", "active"].includes(event.status),
      ).length,
      criticalEvents: events.filter((event) => event.severity === 5).length,
      reportsLast24Hours: events.reduce(
        (count, event) => count + event.sourceReportIds.length,
        0,
      ),
      trendPercent: [-4, 8, 12, 17, -2, 21, 6, 13, -7, 9][index],
    };
  }),
  componentHealth: [
    {
      id: "health-collectors",
      name: "Collector fleet",
      status: "degraded",
      latencyMs: 236,
      backlog: 5,
      lastSuccessfulAt: `${SCENARIO_DATE}T14:27:42Z`,
      message: "Two fictional sources are degraded; ingestion continues.",
    },
    {
      id: "health-database",
      name: "Event database",
      status: "operational",
      latencyMs: 18,
      backlog: 0,
      lastSuccessfulAt: `${SCENARIO_DATE}T14:29:51Z`,
      message: "Demonstration datastore is responding normally.",
    },
    {
      id: "health-processing",
      name: "Intelligence pipeline",
      status: "operational",
      latencyMs: 143,
      backlog: 5,
      lastSuccessfulAt: `${SCENARIO_DATE}T14:29:12Z`,
      message: "Five fictional reports await processing.",
    },
    {
      id: "health-aether",
      name: "Aether mock analyst",
      status: "operational",
      latencyMs: 42,
      lastSuccessfulAt: `${SCENARIO_DATE}T14:28:33Z`,
      message: "Deterministic local response mode is active.",
    },
  ],
  dataClassification: DATA_CLASSIFICATION,
  demoDataLabel: DEMONSTRATION_DATA_LABEL,
};

export const demoDataCounts = {
  events: demoEvents.length,
  reports: demoReports.length,
  sources: demoSources.length,
  watchlists: demoWatchlists.length,
  briefs: demoBriefs.length,
  timelineEntries: demoTimelineEntries.length,
  auditEntries: demoAuditEntries.length,
  collectorRuns: demoCollectorRuns.length,
  duplicateReports: demoReports.filter(
    (report) => report.processingStatus === "duplicate",
  ).length,
  contradictoryClaims: demoMetrics.contradictoryClaims,
  reviewRequiredEvents: demoMetrics.eventsAwaitingReview,
  analystConfirmedEvents: demoEvents.filter(
    (event) => event.verificationState === "analyst-confirmed",
  ).length,
} as const;

export function getEventBySlug(slug: string): IntelligenceEvent | null {
  return demoEvents.find((event) => event.slug === slug) ?? null;
}

export function getEventById(id: string): IntelligenceEvent | null {
  return demoEvents.find((event) => event.id === id) ?? null;
}

export function getReportsForEvent(eventId: string): SourceReport[] {
  return demoReports.filter((report) => report.eventId === eventId);
}

export function getTimelineForEvent(eventId: string): EventTimelineEntry[] {
  return demoTimelineEntries
    .filter((entry) => entry.eventId === eventId)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export const demoDataProvider: IntelligenceDataProvider = {
  async getEvents() {
    return demoEvents;
  },
  async getEventBySlug(slug: string) {
    return getEventBySlug(slug);
  },
  async getReports() {
    return demoReports;
  },
  async getBriefs() {
    return demoBriefs;
  },
  async getWatchlists() {
    return demoWatchlists;
  },
  async getSources() {
    return demoSources;
  },
};

export const mockIntelligenceDataProvider = demoDataProvider;

export function validateDemoDataRelationships(): string[] {
  const issues: string[] = [];
  const eventIds = new Set(demoEvents.map((event) => event.id));
  const reportIds = new Set(demoReports.map((report) => report.id));
  const sourceIds = new Set(demoSources.map((source) => source.id));
  const watchlistIds = new Set(
    demoWatchlists.map((watchlist) => watchlist.id),
  );

  for (const report of demoReports) {
    if (!sourceIds.has(report.sourceId)) {
      issues.push(`${report.id} references missing source ${report.sourceId}.`);
    }
    if (report.eventId && !eventIds.has(report.eventId)) {
      issues.push(`${report.id} references missing event ${report.eventId}.`);
    }
    if (
      report.duplicateOfReportId &&
      !reportIds.has(report.duplicateOfReportId)
    ) {
      issues.push(
        `${report.id} references missing duplicate ${report.duplicateOfReportId}.`,
      );
    }
  }

  for (const event of demoEvents) {
    for (const id of event.sourceReportIds) {
      if (!reportIds.has(id)) {
        issues.push(`${event.id} references missing report ${id}.`);
      }
    }
    for (const id of [
      ...event.relatedEventIds,
      ...event.possibleDuplicateOfEventIds,
    ]) {
      if (!eventIds.has(id)) {
        issues.push(`${event.id} references missing related event ${id}.`);
      }
    }
    for (const id of event.watchlistIds) {
      if (!watchlistIds.has(id)) {
        issues.push(`${event.id} references missing watchlist ${id}.`);
      }
    }
    for (const claim of [
      ...event.confirmedFacts,
      ...event.unverifiedClaims,
      ...event.disputedClaims,
    ]) {
      for (const id of [
        ...claim.supportingReportIds,
        ...claim.contradictingReportIds,
      ]) {
        if (!reportIds.has(id)) {
          issues.push(`${claim.id} references missing report ${id}.`);
        }
      }
    }
  }

  for (const watchlist of demoWatchlists) {
    for (const id of watchlist.matchedEventIds) {
      if (!eventIds.has(id)) {
        issues.push(`${watchlist.id} references missing event ${id}.`);
      }
    }
  }

  for (const brief of demoBriefs) {
    for (const id of brief.eventIds) {
      if (!eventIds.has(id)) {
        issues.push(`${brief.id} references missing event ${id}.`);
      }
    }
  }

  return issues;
}
