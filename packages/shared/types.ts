export type DemoDataClassification = "demonstration";

export type EventCategory =
  | "conflict"
  | "political"
  | "cyber"
  | "disaster"
  | "maritime"
  | "aviation"
  | "health"
  | "infrastructure"
  | "economic"
  | "crime"
  | "technology"
  | "environment"
  | "local"
  | "other";

export type EventStatus =
  | "emerging"
  | "developing"
  | "active"
  | "stable"
  | "resolved"
  | "disputed"
  | "rejected";

export type EventSeverity = 1 | 2 | 3 | 4 | 5;

export type ConfidenceLabel =
  | "unverified"
  | "low"
  | "moderate"
  | "high"
  | "strongly-corroborated";

export type VerificationState =
  | "automated"
  | "needs-review"
  | "analyst-confirmed"
  | "analyst-rejected"
  | "disputed";

export type ClaimStatus =
  | "unverified"
  | "corroborated"
  | "confirmed"
  | "disputed"
  | "rejected";

export type ConfidenceFactorCode =
  | "official-source"
  | "independent-sources"
  | "source-reliability"
  | "time-location-match"
  | "external-id-match"
  | "structured-evidence"
  | "supporting-media"
  | "detail-consistency"
  | "anonymous-only"
  | "low-reliability-source"
  | "circular-reporting"
  | "major-contradiction"
  | "missing-time-or-location"
  | "sensational-language"
  | "stale-evidence"
  | "unsupported-social-claim";

export interface ConfidenceFactor {
  id: string;
  code: ConfidenceFactorCode;
  label: string;
  description: string;
  direction: "positive" | "negative";
  weight: number;
  appliedScore: number;
  reportIds: string[];
}

export interface ConfidenceAssessment {
  score: number;
  label: ConfidenceLabel;
  positiveFactors: ConfidenceFactor[];
  negativeFactors: ConfidenceFactor[];
  calculatedAt: string;
  modelVersion: string;
  explanation: string;
}

export interface IntelligenceClaim {
  id: string;
  text: string;
  confidence: number;
  status: ClaimStatus;
  supportingReportIds: string[];
  contradictingReportIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: EventCategory;
  status: EventStatus;
  severity: EventSeverity;
  automatedConfidence: number;
  confidenceLabel: ConfidenceLabel;
  confidenceAssessment: ConfidenceAssessment;
  verificationState: VerificationState;
  countryCode?: string;
  countryName?: string;
  region?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  tags: string[];
  confirmedFacts: IntelligenceClaim[];
  unverifiedClaims: IntelligenceClaim[];
  disputedClaims: IntelligenceClaim[];
  relatedEventIds: string[];
  possibleDuplicateOfEventIds: string[];
  sourceReportIds: string[];
  entityIds: string[];
  watchlistIds: string[];
  officialSourceCount: number;
  supportingSourceCount: number;
  contradictionCount: number;
  reviewRequired: boolean;
  priority: boolean;
  analystNotes?: string;
  aetherAssessment?: string;
  reviewedAt?: string;
  reviewerName?: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export type ReportProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "duplicate"
  | "rejected"
  | "failed";

export interface SourceReport {
  id: string;
  sourceId: string;
  eventId?: string;
  externalId?: string;
  url: string;
  normalizedUrl?: string;
  title: string;
  description?: string;
  bodyText?: string;
  author?: string;
  language?: string;
  publishedAt: string;
  collectedAt: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  category?: EventCategory;
  rawPayload: unknown;
  contentHash: string;
  processingStatus: ReportProcessingStatus;
  duplicateOfReportId?: string;
  rejectionReason?: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export type SourceType = "rss" | "atom" | "api" | "webhook" | "dataset";
export type SourceStatus = "online" | "degraded" | "offline" | "paused" | "unknown";

export interface CollectionSchedule {
  label: string;
  intervalMinutes: number;
  cron?: string;
  timezone: string;
}

export interface IntelligenceSource {
  id: string;
  name: string;
  organization: string;
  type: SourceType;
  url: string;
  countryCode?: string;
  region?: string;
  categories: EventCategory[];
  reliabilityScore: number;
  independenceGroup: string;
  limitations: string;
  enabled: boolean;
  status: SourceStatus;
  lastCheckedAt?: string;
  lastSuccessfulCollectionAt?: string;
  recentFailureCount: number;
  reportsCollected: number;
  attributionRequirements: string;
  schedule: CollectionSchedule;
  rateLimitPerMinute?: number;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface IntelligenceEntity {
  id: string;
  name: string;
  type:
    | "country"
    | "region"
    | "city"
    | "organization"
    | "company"
    | "person"
    | "ship"
    | "aircraft"
    | "military-unit"
    | "cyber-group"
    | "vulnerability"
    | "infrastructure"
    | "other";
  aliases: string[];
  countryCode?: string;
  description?: string;
}

export type WatchlistType =
  | "country"
  | "region"
  | "city"
  | "organization"
  | "government-agency"
  | "company"
  | "person"
  | "ship"
  | "aircraft"
  | "military-unit"
  | "cyber-group"
  | "vulnerability"
  | "keyword"
  | "event-category"
  | "geographic-area";

export type WatchlistPriority = "low" | "medium" | "high" | "critical";

export interface WatchlistMatchRule {
  field: "title" | "summary" | "tags" | "entity" | "category" | "country" | "coordinates";
  operator: "contains" | "equals" | "in" | "within-radius";
  value: string | string[] | { latitude: number; longitude: number; radiusKm: number };
  caseSensitive?: boolean;
}

export interface WatchlistNotificationSettings {
  inApp: boolean;
  email: boolean;
  minimumSeverity: EventSeverity;
  minimumConfidence: number;
  digest: "immediate" | "hourly" | "daily";
}

export interface WatchlistEntry {
  id: string;
  name: string;
  type: WatchlistType;
  matchRules: WatchlistMatchRule[];
  priority: WatchlistPriority;
  enabled: boolean;
  notificationSettings: WatchlistNotificationSettings;
  lastMatchAt?: string;
  matchCount: number;
  matchedEventIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export type BriefType = "daily" | "weekly" | "custom";
export type BriefStatus = "draft" | "published" | "archived";

export interface BriefDevelopment {
  eventId: string;
  headline: string;
  assessment: string;
  confidence: number;
}

export interface BriefSection {
  id: string;
  title: string;
  summary: string;
  eventIds: string[];
  items: string[];
}

export interface IntelligenceBrief {
  id: string;
  slug: string;
  title: string;
  type: BriefType;
  status: BriefStatus;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy: "Aether" | "analyst";
  executiveSummary: string;
  priorityDevelopments: BriefDevelopment[];
  regionalDevelopments: BriefSection[];
  watchlistActivity: BriefSection[];
  escalationRisks: BriefSection[];
  confidenceChanges: BriefSection[];
  disputedReporting: BriefSection[];
  eventsRequiringReview: BriefSection[];
  resolvedEvents: BriefSection[];
  collectionGaps: string[];
  aetherAnalysis: string;
  eventIds: string[];
  publishedAt?: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export type TimelineEntryType =
  | "initial-detection"
  | "report-added"
  | "official-statement"
  | "confidence-change"
  | "severity-change"
  | "contradiction"
  | "analyst-decision"
  | "aether-summary"
  | "resolution";

export interface EventTimelineEntry {
  id: string;
  eventId: string;
  type: TimelineEntryType;
  occurredAt: string;
  title: string;
  description: string;
  reportIds: string[];
  actor: "system" | "Aether" | "analyst" | "source";
  metadata?: Record<string, string | number | boolean>;
  dataClassification: DemoDataClassification;
}

export type AuditAction =
  | "event-confirmed"
  | "event-rejected"
  | "event-disputed"
  | "evidence-requested"
  | "event-edited"
  | "events-merged"
  | "event-separated"
  | "claim-confirmed"
  | "claim-rejected"
  | "priority-pinned"
  | "watchlist-added"
  | "source-edited"
  | "collector-run";

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actorId: string;
  actorName: string;
  actorType: "analyst" | "system" | "collector" | "Aether";
  action: AuditAction;
  targetType: "event" | "claim" | "report" | "source" | "watchlist" | "brief" | "collector";
  targetId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  correlationId: string;
  dataClassification: DemoDataClassification;
}

export interface CollectorContext {
  source: IntelligenceSource;
  requestedAt: string;
  since?: string;
  cursor?: string;
  signal?: AbortSignal;
  requestId: string;
}

export interface CollectedReport {
  externalId?: string;
  url: string;
  title: string;
  description?: string;
  bodyText?: string;
  author?: string;
  language?: string;
  publishedAt: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  rawPayload: unknown;
}

export interface IntelligenceCollector {
  id: string;
  name: string;
  type: "rss" | "api" | "webhook" | "dataset";
  collect(context: CollectorContext): Promise<CollectedReport[]>;
}

export type CollectorRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "dead-lettered";

export interface CollectorRun {
  id: string;
  collectorId: string;
  sourceId: string;
  status: CollectorRunStatus;
  startedAt: string;
  completedAt?: string;
  reportsSeen: number;
  reportsInserted: number;
  duplicatesSkipped: number;
  rejectedCount: number;
  retryCount: number;
  durationMs?: number;
  nextCursor?: string;
  errorMessage?: string;
  requestId: string;
  dataClassification: DemoDataClassification;
}

export interface RegionalActivityMetric {
  region: string;
  activeEvents: number;
  criticalEvents: number;
  reportsLast24Hours: number;
  trendPercent: number;
}

export interface SystemComponentHealth {
  id: string;
  name: string;
  status: "operational" | "degraded" | "offline" | "maintenance";
  latencyMs?: number;
  backlog?: number;
  lastSuccessfulAt?: string;
  message: string;
}

export interface PlatformMetrics {
  generatedAt: string;
  activeEvents: number;
  developingEvents: number;
  criticalEvents: number;
  reportsCollectedToday: number;
  reportsAwaitingProcessing: number;
  eventsAwaitingReview: number;
  contradictoryClaims: number;
  sourcesOnline: number;
  sourcesTotal: number;
  failedSources: number;
  processingBacklog: number;
  averageApiResponseMs: number;
  lastSuccessfulIngestionAt: string;
  workerStatus: "operational" | "degraded" | "offline";
  databaseStatus: "operational" | "degraded" | "offline";
  regionalActivity: RegionalActivityMetric[];
  componentHealth: SystemComponentHealth[];
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface IntelligenceDataProvider {
  getEvents(): Promise<IntelligenceEvent[]>;
  getEventBySlug(slug: string): Promise<IntelligenceEvent | null>;
  getReports(): Promise<SourceReport[]>;
  getBriefs(): Promise<IntelligenceBrief[]>;
  getWatchlists(): Promise<WatchlistEntry[]>;
  getSources(): Promise<IntelligenceSource[]>;
}

export interface AetherCitation {
  reportId: string;
  sourceId: string;
  label: string;
}

export interface AetherResponse {
  id: string;
  mode: "chat" | "event-context" | "source-comparison" | "brief-generation" | "contradiction-analysis";
  generatedAt: string;
  answer: string;
  evidenceSummary: string;
  citations: AetherCitation[];
  relatedEventIds: string[];
  confidenceExplanation: string;
  generatedBy: "Aether";
  dataClassification: DemoDataClassification;
}

export interface AetherProvider {
  respond(prompt: string, contextEventIds?: string[]): Promise<AetherResponse>;
}
