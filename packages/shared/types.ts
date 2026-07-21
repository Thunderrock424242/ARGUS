export type DemoDataClassification = "demonstration" | "public-information";

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
  | "unsupported-social-claim"
  | "public-review-ceiling";

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
  /** D1 read-model revision supplied by the Worker; absent for bundled fixtures. */
  recordVersion?: number;
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
  /** Review-controlled ceiling applied to public-information evidence. */
  confidence?: number;
  /** Public reports remain needs-review until an explicit analyst decision. */
  verificationState?: VerificationState;
  confidenceUpdatedAt?: string;
  confidenceUpdatedById?: string;
  confidenceUpdatedByName?: string;
  confidenceUpdateReason?: string;
  duplicateOfReportId?: string;
  rejectionReason?: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export type IngestionSubmissionStatus =
  | "needs-review"
  | "duplicate"
  | "approved"
  | "rejected"
  | "failed";

export type IngestionMethod = "manual" | "collector" | "api" | "webhook";

export interface IngestionProvenance {
  method: IngestionMethod;
  submittedById: string;
  submittedByName: string;
  sourceUrl: string;
  attribution?: string;
  notes?: string;
  requestId: string;
}

/** A normalized, non-public intake record awaiting an explicit reviewer decision. */
export interface IngestionSubmission {
  id: string;
  sourceId: string;
  externalId?: string;
  idempotencyKey: string;
  contentHash: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description?: string;
  bodyText?: string;
  author?: string;
  language: string;
  publishedAt: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  category?: EventCategory;
  status: IngestionSubmissionStatus;
  duplicateOfReportId?: string;
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
  submittedAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewReason?: string;
  confidence: number;
  confidenceUpdatedAt?: string;
  confidenceUpdatedById?: string;
  confidenceUpdatedByName?: string;
  confidenceUpdateReason?: string;
  provenance: IngestionProvenance;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
  recordVersion: number;
}

export interface IngestionAttempt {
  id: string;
  submissionId: string;
  attempt: number;
  state: "accepted" | "failed" | "retried";
  startedAt: string;
  completedAt: string;
  errorCode?: string;
  errorMessage?: string;
  requestId: string;
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
  | "collector-run"
  | "ingestion-submitted"
  | "ingestion-approved"
  | "ingestion-rejected"
  | "ingestion-retried"
  | "ingestion-confidence-updated"
  | "relationship-confirmed"
  | "relationship-rejected"
  | "relationship-disputed"
  | "relationship-recalculated"
  | "market-assessment-reviewed"
  | "consequence-converted"
  | "alert-acknowledged"
  | "alert-dismissed"
  | "monitoring-layout-saved"
  | "read-model-seeded"
  | "retention-enforced"
  | "identity-roles-updated";

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actorId: string;
  actorName: string;
  actorType: "analyst" | "system" | "collector" | "Aether";
  action: AuditAction;
  targetType:
    | "event"
    | "claim"
    | "report"
    | "source"
    | "watchlist"
    | "brief"
    | "collector"
    | "ingestion-submission"
    | "relationship"
    | "market-assessment"
    | "conflict"
    | "alert"
    | "monitoring-layout"
    | "read-model"
    | "user";
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
  mode?: "dry-run" | "live";
  scheduledFor?: string;
  attempt?: number;
  nextRetryAt?: string;
  networkAccessed?: boolean;
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

export type GraphNodeType =
  | "event"
  | "entity"
  | "location"
  | "country"
  | "region"
  | "industry"
  | "company"
  | "infrastructure"
  | "stock"
  | "etf"
  | "index"
  | "commodity"
  | "currency"
  | "cryptocurrency"
  | "supply-chain";

export type RelationshipType =
  | "confirmed-impact"
  | "likely-impact"
  | "possible-impact"
  | "correlated-movement"
  | "exposure-only"
  | "hypothesized-consequence"
  | "triggered-response"
  | "escalated"
  | "deescalated"
  | "disrupted"
  | "related-event"
  | "disputed"
  | "analyst-rejected";

export type AnalystRelationshipState =
  | "automated"
  | "needs-review"
  | "confirmed"
  | "rejected"
  | "disputed";

export interface IntelligenceGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  subtitle?: string;
  description: string;
  eventId?: string;
  countryCode?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  tags: string[];
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface IntelligenceRelationship {
  id: string;
  sourceNodeId: string;
  sourceNodeType: GraphNodeType;
  targetNodeId: string;
  targetNodeType: GraphNodeType;
  relationshipType: RelationshipType;
  relationshipConfidence: number;
  exposureConfidence?: number;
  causalConfidence?: number;
  marketAnomalyScore?: number;
  supportingReportIds: string[];
  contradictingReportIds: string[];
  explanation: string;
  detectionMethod:
    | "rule"
    | "structured-data"
    | "market-analysis"
    | "semantic-analysis"
    | "analyst";
  createdAt: string;
  lastRecalculatedAt: string;
  analystState: AnalystRelationshipState;
  analystNotes?: string;
  modelVersion: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
  /** D1 read-model revision supplied by the Worker; absent for bundled fixtures. */
  recordVersion?: number;
}

export interface RelationshipHistoryEntry {
  id: string;
  relationshipId: string;
  occurredAt: string;
  relationshipConfidence: number;
  exposureConfidence?: number;
  causalConfidence?: number;
  marketAnomalyScore?: number;
  analystState: AnalystRelationshipState;
  explanation: string;
  supportingReportIds: string[];
  contradictingReportIds: string[];
  rulesetVersion: string;
  actor: "system" | "Aether" | "analyst";
  dataClassification: DemoDataClassification;
}

export interface ImpactRuleCondition {
  field: "category" | "severity" | "status" | "tag" | "country" | "region";
  operator: "equals" | "includes" | "minimum";
  value: string | number;
}

export interface ImpactRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerCategories: EventCategory[];
  requiredEntityTypes?: string[];
  requiredKeywords?: string[];
  targetNodeTypes: GraphNodeType[];
  targetNodeIds?: string[];
  relationshipType: RelationshipType;
  timeWindowHours: number;
  maximumDistanceKm?: number;
  baseRelationshipConfidence: number;
  baseExposureConfidence?: number;
  baseCausalConfidence?: number;
  conditions: ImpactRuleCondition[];
  explanationTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export type MarketAssetType =
  | "stock"
  | "etf"
  | "index"
  | "commodity"
  | "currency"
  | "cryptocurrency"
  | "government-debt"
  | "sector-basket"
  | "industry-basket";

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  type: MarketAssetType;
  exchange?: string;
  currency: string;
  countryCode?: string;
  sector?: string;
  industry?: string;
  exposureTags: string[];
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface MarketImpactAssessment {
  id: string;
  eventId: string;
  assetId: string;
  exposureConfidence: number;
  relationshipConfidence: number;
  marketAnomalyScore: number;
  causalConfidence: number;
  priceBefore?: number;
  priceAfter?: number;
  percentChange?: number;
  volumeChangePercent?: number;
  normalVolatility?: number;
  sectorChangePercent?: number;
  indexChangePercent?: number;
  broaderMarketChangePercent?: number;
  commodityChangePercent?: number;
  currencyChangePercent?: number;
  supportingReportIds: string[];
  contradictingReportIds: string[];
  explanation: string;
  analystState: AnalystRelationshipState;
  calculatedAt: string;
  modelVersion: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface SourceAttributedEstimate {
  id: string;
  metric: "casualties" | "displaced" | "infrastructure-damage";
  minimum: number;
  maximum: number;
  asOf: string;
  sourceReportIds: string[];
  confidence: number;
  methodology: string;
}

export interface ConflictProfile {
  id: string;
  slug: string;
  name: string;
  countries: string[];
  regions: string[];
  startDate: string;
  currentPhase: string;
  keyActorNodeIds: string[];
  territorialAreas: string[];
  eventIds: string[];
  relationshipIds: string[];
  estimates: SourceAttributedEstimate[];
  recentDevelopments: string[];
  humanitarianEffects: string[];
  infrastructureEffects: string[];
  economicEffects: string[];
  relatedSanctions: string[];
  collectionGaps: string[];
  disputedFigures: string[];
  analystNotes: string;
  aetherAssessment: string;
  updatedAt: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface RegionalIntelligenceProfile {
  id: string;
  name: string;
  kind: "country" | "region";
  countryCode?: string;
  threatLevel: "baseline" | "guarded" | "elevated" | "high" | "critical";
  threatEvidenceReportIds: string[];
  activeEventIds: string[];
  developingEventIds: string[];
  conflictProfileIds: string[];
  keyNodeIds: string[];
  marketAssessmentIds: string[];
  watchlistIds: string[];
  strategicInfrastructure: string[];
  collectionGaps: string[];
  latestAssessment: string;
  analystNotes: string;
  updatedAt: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export type IntelligenceStateChangeType =
  | TimelineEntryType
  | "relationship-created"
  | "relationship-recalculated"
  | "market-assessment-created"
  | "watchlist-triggered"
  | "alert-issued";

export interface IntelligenceStateChange {
  id: string;
  occurredAt: string;
  type: IntelligenceStateChangeType;
  eventId?: string;
  relationshipId?: string;
  marketAssessmentId?: string;
  title: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reportIds: string[];
  actor: "system" | "Aether" | "analyst" | "source";
  dataClassification: DemoDataClassification;
}

export type AlertType =
  | "new-event"
  | "priority-event"
  | "severity-change"
  | "confidence-change"
  | "official-confirmation"
  | "watchlist-match"
  | "contradiction"
  | "market-anomaly"
  | "infrastructure-disruption"
  | "relationship-detected"
  | "consequence-predicted"
  | "source-status"
  | "brief-ready";

export type AlertPriority = "low" | "normal" | "high" | "critical";
export type AlertState = "queued" | "active" | "acknowledged" | "dismissed" | "expired";

export interface IntelligenceAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  state: AlertState;
  title: string;
  message: string;
  voiceMessage: string;
  eventId?: string;
  relationshipId?: string;
  createdAt: string;
  acknowledgedAt?: string;
  dismissedAt?: string;
  deduplicationKey: string;
  cooldownSeconds: number;
  visualRequired: true;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
  /** D1 read-model revision supplied by the Worker; absent for bundled fixtures. */
  recordVersion?: number;
}

export interface AlertSettings {
  masterAudio: boolean;
  voiceAlerts: boolean;
  interfaceSounds: boolean;
  voiceVolume: number;
  soundVolume: number;
  minimumSeverity: EventSeverity;
  minimumConfidence: number;
  minimumRelationshipConfidence: number;
  minimumMarketAnomaly: number;
  enabledCategories: EventCategory[];
  enabledRegions: string[];
  enabledAssetTypes: MarketAssetType[];
  watchlistOnly: boolean;
  quietMode: boolean;
  doNotDisturbStart?: string;
  doNotDisturbEnd?: string;
  repeatCooldownMinutes: number;
  speechRate: number;
}

export interface VoiceAlertRequest {
  message: string;
  priority: AlertPriority;
  eventId?: string;
  relationshipId?: string;
  interruptCurrent?: boolean;
}

export interface VoiceAlertProvider {
  speak(request: VoiceAlertRequest): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
}

export type CameraAvailability = "available" | "unavailable" | "blocked" | "unknown";
export type CameraEmbedPermission = "verified" | "link-only" | "not-permitted" | "unknown";

export interface PublicCameraSource {
  id: string;
  name: string;
  operator: string;
  sourceUrl: string;
  embedUrl?: string;
  latitude: number;
  longitude: number;
  location: string;
  country: string;
  category: "traffic" | "city" | "weather" | "volcano" | "port" | "airport" | "emergency" | "news";
  usageInformation: string;
  attributionRequirements: string;
  embedPermission: CameraEmbedPermission;
  lastSuccessfulCheck?: string;
  availability: CameraAvailability;
  relatedEventIds: string[];
  relatedRegionIds: string[];
  relatedInfrastructureIds: string[];
  refreshIntervalSeconds: number;
  accessRestrictions: string[];
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export type MonitoringWidgetType =
  | "map"
  | "camera"
  | "timeline"
  | "impact-graph"
  | "market-chart"
  | "alert-stream"
  | "regional-panel"
  | "report-feed"
  | "collector-status"
  | "aether-brief"
  | "conflict-profile"
  | "watchlist-activity"
  | "review-queue";

export interface MonitoringWidget {
  id: string;
  type: MonitoringWidgetType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  configuration: Record<string, string | number | boolean>;
}

export interface MonitoringLayout {
  id: string;
  ownerId?: string;
  name: string;
  widgets: MonitoringWidget[];
  updatedAt: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
  /** D1 read-model revision supplied by the Worker; zero denotes an unsaved template. */
  recordVersion?: number;
}

export interface IntelligenceDataProvider {
  getEvents(): Promise<IntelligenceEvent[]>;
  getEventBySlug(slug: string): Promise<IntelligenceEvent | null>;
  getReports(): Promise<SourceReport[]>;
  getBriefs(): Promise<IntelligenceBrief[]>;
  getWatchlists(): Promise<WatchlistEntry[]>;
  getSources(): Promise<IntelligenceSource[]>;
  getGraphNodes(): Promise<IntelligenceGraphNode[]>;
  getRelationships(): Promise<IntelligenceRelationship[]>;
  getRelationshipHistory(): Promise<RelationshipHistoryEntry[]>;
  getMarketAssets(): Promise<MarketAsset[]>;
  getMarketImpacts(): Promise<MarketImpactAssessment[]>;
  getConflictProfiles(): Promise<ConflictProfile[]>;
  getRegionalProfiles(): Promise<RegionalIntelligenceProfile[]>;
  getStateHistory(): Promise<IntelligenceStateChange[]>;
  getAlerts(): Promise<IntelligenceAlert[]>;
  getCameraSources(): Promise<PublicCameraSource[]>;
  getMonitoringLayouts(): Promise<MonitoringLayout[]>;
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
