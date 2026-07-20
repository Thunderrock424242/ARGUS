import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Durable D1 schema for ARGUS. Rich, evolving analysis payloads are stored as
 * JSON while fields used for filtering, joins, and auditability remain typed
 * columns with database constraints.
 */
export const authUsers = sqliteTable(
  "auth_users",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    login: text("login").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastAuthenticatedAt: text("last_authenticated_at").notNull(),
  },
  (table) => [
    uniqueIndex("auth_users_provider_subject_unique").on(table.provider, table.providerSubject),
    index("auth_users_provider_login_idx").on(table.provider, table.login),
    index("auth_users_status_idx").on(table.status),
    check("auth_users_provider_check", sql`${table.provider} = 'github'`),
    check("auth_users_status_check", sql`${table.status} in ('active', 'disabled')`),
  ],
);

export const authUserRoles = sqliteTable(
  "auth_user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    grantedAt: text("granted_at").notNull(),
    grantedBy: text("granted_by").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("auth_user_roles_role_idx").on(table.role, table.userId),
    check(
      "auth_user_roles_role_check",
      sql`${table.role} in ('viewer', 'analyst', 'reviewer', 'source-manager', 'administrator')`,
    ),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    lastUsedAt: text("last_used_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    index("auth_sessions_user_idx").on(table.userId, table.expiresAt),
    index("auth_sessions_expiry_idx").on(table.expiresAt, table.revokedAt),
  ],
);

export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    keyHash: text("key_hash").notNull(),
    windowStartedAt: integer("window_started_at").notNull(),
    count: integer("count").notNull().default(1),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyHash, table.windowStartedAt] }),
    index("auth_rate_limits_expiry_idx").on(table.expiresAt),
    check("auth_rate_limits_count_check", sql`${table.count} >= 1`),
  ],
);

export const intelligenceSources = sqliteTable(
  "intelligence_sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organization: text("organization").notNull(),
    type: text("type").notNull(),
    url: text("url").notNull(),
    countryCode: text("country_code"),
    region: text("region"),
    categories: text("categories", { mode: "json" }).$type<string[]>().notNull(),
    reliabilityScore: integer("reliability_score").notNull(),
    independenceGroup: text("independence_group").notNull(),
    limitations: text("limitations").notNull(),
    attributionRequirements: text("attribution_requirements").notNull(),
    status: text("status").notNull().default("unknown"),
    schedule: text("schedule", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    lastCheckedAt: text("last_checked_at"),
    lastSuccessfulCollectionAt: text("last_successful_collection_at"),
    recentFailureCount: integer("recent_failure_count").notNull().default(0),
    reportsCollected: integer("reports_collected").notNull().default(0),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("intelligence_sources_url_unique").on(table.url),
    index("intelligence_sources_enabled_idx").on(table.enabled),
    index("intelligence_sources_independence_idx").on(table.independenceGroup),
    check("intelligence_sources_reliability_check", sql`${table.reliabilityScore} between 0 and 100`),
  ],
);

export const sourceReports = sqliteTable(
  "source_reports",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => intelligenceSources.id, { onDelete: "restrict" }),
    externalId: text("external_id"),
    url: text("url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    bodyText: text("body_text"),
    author: text("author"),
    language: text("language").notNull().default("en"),
    publishedAt: text("published_at").notNull(),
    collectedAt: text("collected_at").notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    countryCode: text("country_code"),
    contentHash: text("content_hash").notNull(),
    processingStatus: text("processing_status").notNull(),
    rawPayload: text("raw_payload", { mode: "json" }).$type<unknown>().notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    lastError: text("last_error"),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [
    uniqueIndex("source_reports_source_external_unique").on(table.sourceId, table.externalId),
    index("source_reports_hash_idx").on(table.contentHash),
    index("source_reports_normalized_url_idx").on(table.normalizedUrl),
    index("source_reports_status_collected_idx").on(table.processingStatus, table.collectedAt),
    index("source_reports_published_idx").on(table.publishedAt),
  ],
);

export const intelligenceEvents = sqliteTable(
  "intelligence_events",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull(),
    severity: integer("severity").notNull(),
    automatedConfidence: integer("automated_confidence").notNull(),
    confidenceLabel: text("confidence_label").notNull(),
    verificationState: text("verification_state").notNull(),
    countryCode: text("country_code"),
    countryName: text("country_name"),
    region: text("region"),
    locationName: text("location_name"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    firstDetectedAt: text("first_detected_at").notNull(),
    lastUpdatedAt: text("last_updated_at").notNull(),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    relatedEventIds: text("related_event_ids", { mode: "json" }).$type<string[]>().notNull(),
    entityIds: text("entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    analystNotes: text("analyst_notes"),
    aetherAssessment: text("aether_assessment"),
    reviewedAt: text("reviewed_at"),
    reviewerName: text("reviewer_name"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("intelligence_events_slug_unique").on(table.slug),
    index("intelligence_events_status_idx").on(table.status),
    index("intelligence_events_category_idx").on(table.category),
    index("intelligence_events_region_idx").on(table.region),
    index("intelligence_events_review_idx").on(table.verificationState, table.severity),
    index("intelligence_events_updated_idx").on(table.lastUpdatedAt),
    check("intelligence_events_severity_check", sql`${table.severity} between 1 and 5`),
    check(
      "intelligence_events_confidence_check",
      sql`${table.automatedConfidence} between 0 and 99`,
    ),
  ],
);

export const eventReportLinks = sqliteTable(
  "event_report_links",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => intelligenceEvents.id, { onDelete: "cascade" }),
    reportId: text("report_id")
      .notNull()
      .references(() => sourceReports.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("supporting"),
    correlationScore: integer("correlation_score"),
    linkedAt: text("linked_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.reportId] }),
    index("event_report_links_report_idx").on(table.reportId),
  ],
);

export const intelligenceClaims = sqliteTable(
  "intelligence_claims",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => intelligenceEvents.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    confidence: integer("confidence").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("intelligence_claims_event_idx").on(table.eventId),
    index("intelligence_claims_status_idx").on(table.status),
    check("intelligence_claims_confidence_check", sql`${table.confidence} between 0 and 99`),
  ],
);

export const claimReportEvidence = sqliteTable(
  "claim_report_evidence",
  {
    claimId: text("claim_id")
      .notNull()
      .references(() => intelligenceClaims.id, { onDelete: "cascade" }),
    reportId: text("report_id")
      .notNull()
      .references(() => sourceReports.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.claimId, table.reportId, table.relationship] }),
    index("claim_report_evidence_report_idx").on(table.reportId),
  ],
);

export const confidenceAssessments = sqliteTable(
  "confidence_assessments",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => intelligenceEvents.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    label: text("label").notNull(),
    positiveFactors: text("positive_factors", { mode: "json" }).$type<unknown[]>().notNull(),
    negativeFactors: text("negative_factors", { mode: "json" }).$type<unknown[]>().notNull(),
    calculatedAt: text("calculated_at").notNull(),
    modelVersion: text("model_version").notNull(),
  },
  (table) => [
    index("confidence_assessments_event_time_idx").on(table.eventId, table.calculatedAt),
    check("confidence_assessments_score_check", sql`${table.score} between 0 and 99`),
  ],
);

export const analystReviews = sqliteTable(
  "analyst_reviews",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => intelligenceEvents.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    stateBefore: text("state_before", { mode: "json" }).$type<unknown>(),
    stateAfter: text("state_after", { mode: "json" }).$type<unknown>(),
    notes: text("notes"),
    reviewerId: text("reviewer_id"),
    reviewerName: text("reviewer_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("analyst_reviews_event_time_idx").on(table.eventId, table.createdAt),
    index("analyst_reviews_action_idx").on(table.action),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    occurredAt: text("occurred_at").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    summary: text("summary").notNull(),
    before: text("before", { mode: "json" }).$type<unknown>(),
    after: text("after", { mode: "json" }).$type<unknown>(),
    reason: text("reason"),
    correlationId: text("correlation_id").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
  },
  (table) => [
    index("audit_logs_target_idx").on(table.targetType, table.targetId, table.occurredAt),
    index("audit_logs_actor_idx").on(table.actorType, table.actorId),
    index("audit_logs_correlation_idx").on(table.correlationId),
  ],
);

export const collectorRuns = sqliteTable(
  "collector_runs",
  {
    id: text("id").primaryKey(),
    collectorId: text("collector_id").notNull(),
    sourceId: text("source_id")
      .notNull()
      .references(() => intelligenceSources.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    mode: text("mode").notNull().default("dry-run"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    reportsSeen: integer("reports_seen").notNull().default(0),
    reportsInserted: integer("reports_inserted").notNull().default(0),
    duplicatesSkipped: integer("duplicates_skipped").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    nextCursor: text("next_cursor"),
    retryCount: integer("retry_count").notNull().default(0),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    requestId: text("request_id").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
  },
  (table) => [
    index("collector_runs_collector_time_idx").on(table.collectorId, table.startedAt),
    index("collector_runs_status_idx").on(table.status),
  ],
);

export const reviewQueueItems = sqliteTable(
  "review_queue_items",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").references(() => intelligenceEvents.id, { onDelete: "cascade" }),
    reportId: text("report_id").references(() => sourceReports.id, { onDelete: "cascade" }),
    queueType: text("queue_type").notNull(),
    priority: integer("priority").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    assignedTo: text("assigned_to"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("review_queue_open_priority_idx").on(table.status, table.priority, table.createdAt),
    check("review_queue_priority_check", sql`${table.priority} between 1 and 5`),
  ],
);

export const watchlists = sqliteTable("watchlists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  matchRules: text("match_rules", { mode: "json" }).$type<unknown[]>().notNull(),
  priority: text("priority").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  notificationSettings: text("notification_settings", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  lastMatchAt: text("last_match_at"),
  matchCount: integer("match_count").notNull().default(0),
  matchedEventIds: text("matched_event_ids", { mode: "json" }).$type<string[]>().notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  dataClassification: text("data_classification").notNull().default("demonstration"),
  demoDataLabel: text("demo_data_label").notNull(),
});

export const intelligenceBriefs = sqliteTable(
  "intelligence_briefs",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull(),
    classificationLabel: text("classification_label").notNull().default("DEMONSTRATION DATA"),
    generatedBy: text("generated_by").notNull(),
    generatedAt: text("generated_at").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    content: text("content", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    eventIds: text("event_ids", { mode: "json" }).$type<string[]>().notNull(),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [
    uniqueIndex("intelligence_briefs_slug_unique").on(table.slug),
    index("intelligence_briefs_generated_idx").on(table.generatedAt),
  ],
);

export const intelligenceGraphNodes = sqliteTable(
  "intelligence_graph_nodes",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    label: text("label").notNull(),
    subtitle: text("subtitle"),
    description: text("description").notNull(),
    eventId: text("event_id").references(() => intelligenceEvents.id, { onDelete: "set null" }),
    countryCode: text("country_code"),
    region: text("region"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("graph_nodes_type_idx").on(table.type),
    index("graph_nodes_event_idx").on(table.eventId),
    index("graph_nodes_region_idx").on(table.region),
    check("graph_nodes_latitude_check", sql`${table.latitude} is null or ${table.latitude} between -90 and 90`),
    check("graph_nodes_longitude_check", sql`${table.longitude} is null or ${table.longitude} between -180 and 180`),
  ],
);

export const intelligenceRelationships = sqliteTable(
  "intelligence_relationships",
  {
    id: text("id").primaryKey(),
    sourceNodeId: text("source_node_id").notNull().references(() => intelligenceGraphNodes.id, { onDelete: "cascade" }),
    sourceNodeType: text("source_node_type").notNull(),
    targetNodeId: text("target_node_id").notNull().references(() => intelligenceGraphNodes.id, { onDelete: "cascade" }),
    targetNodeType: text("target_node_type").notNull(),
    relationshipType: text("relationship_type").notNull(),
    relationshipConfidence: integer("relationship_confidence").notNull(),
    exposureConfidence: integer("exposure_confidence"),
    causalConfidence: integer("causal_confidence"),
    marketAnomalyScore: integer("market_anomaly_score"),
    supportingReportIds: text("supporting_report_ids", { mode: "json" }).$type<string[]>().notNull(),
    contradictingReportIds: text("contradicting_report_ids", { mode: "json" }).$type<string[]>().notNull(),
    explanation: text("explanation").notNull(),
    detectionMethod: text("detection_method").notNull(),
    createdAt: text("created_at").notNull(),
    lastRecalculatedAt: text("last_recalculated_at").notNull(),
    analystState: text("analyst_state").notNull(),
    analystNotes: text("analyst_notes"),
    modelVersion: text("model_version").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [
    index("relationships_source_idx").on(table.sourceNodeId, table.relationshipType),
    index("relationships_target_idx").on(table.targetNodeId, table.relationshipType),
    index("relationships_review_idx").on(table.analystState, table.relationshipConfidence),
    check("relationships_distinct_nodes_check", sql`${table.sourceNodeId} <> ${table.targetNodeId}`),
    check("relationships_confidence_check", sql`${table.relationshipConfidence} between 0 and 100`),
    check("relationships_exposure_check", sql`${table.exposureConfidence} is null or ${table.exposureConfidence} between 0 and 100`),
    check("relationships_causal_check", sql`${table.causalConfidence} is null or ${table.causalConfidence} between 0 and 100`),
    check("relationships_anomaly_check", sql`${table.marketAnomalyScore} is null or ${table.marketAnomalyScore} between 0 and 100`),
  ],
);

export const relationshipHistory = sqliteTable(
  "relationship_history",
  {
    id: text("id").primaryKey(),
    relationshipId: text("relationship_id").notNull().references(() => intelligenceRelationships.id, { onDelete: "cascade" }),
    occurredAt: text("occurred_at").notNull(),
    relationshipConfidence: integer("relationship_confidence").notNull(),
    exposureConfidence: integer("exposure_confidence"),
    causalConfidence: integer("causal_confidence"),
    marketAnomalyScore: integer("market_anomaly_score"),
    analystState: text("analyst_state").notNull(),
    explanation: text("explanation").notNull(),
    supportingReportIds: text("supporting_report_ids", { mode: "json" }).$type<string[]>().notNull(),
    contradictingReportIds: text("contradicting_report_ids", { mode: "json" }).$type<string[]>().notNull(),
    rulesetVersion: text("ruleset_version").notNull(),
    actor: text("actor").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
  },
  (table) => [
    index("relationship_history_lookup_idx").on(table.relationshipId, table.occurredAt),
    check("relationship_history_confidence_check", sql`${table.relationshipConfidence} between 0 and 100`),
  ],
);

export const impactRules = sqliteTable(
  "impact_rules",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    triggerCategories: text("trigger_categories", { mode: "json" }).$type<string[]>().notNull(),
    requiredEntityTypes: text("required_entity_types", { mode: "json" }).$type<string[]>(),
    requiredKeywords: text("required_keywords", { mode: "json" }).$type<string[]>(),
    targetNodeTypes: text("target_node_types", { mode: "json" }).$type<string[]>().notNull(),
    targetNodeIds: text("target_node_ids", { mode: "json" }).$type<string[]>(),
    relationshipType: text("relationship_type").notNull(),
    timeWindowHours: integer("time_window_hours").notNull(),
    maximumDistanceKm: real("maximum_distance_km"),
    baseRelationshipConfidence: integer("base_relationship_confidence").notNull(),
    baseExposureConfidence: integer("base_exposure_confidence"),
    baseCausalConfidence: integer("base_causal_confidence"),
    conditions: text("conditions", { mode: "json" }).$type<Record<string, unknown>[]>().notNull(),
    explanationTemplate: text("explanation_template").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("impact_rules_enabled_idx").on(table.enabled),
    check("impact_rules_time_window_check", sql`${table.timeWindowHours} between 1 and 8760`),
    check("impact_rules_relationship_confidence_check", sql`${table.baseRelationshipConfidence} between 0 and 100`),
  ],
);

export const marketAssets = sqliteTable(
  "market_assets",
  {
    id: text("id").primaryKey(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    exchange: text("exchange"),
    currency: text("currency").notNull(),
    countryCode: text("country_code"),
    sector: text("sector"),
    industry: text("industry"),
    exposureTags: text("exposure_tags", { mode: "json" }).$type<string[]>().notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [
    uniqueIndex("market_assets_symbol_unique").on(table.symbol),
    index("market_assets_type_idx").on(table.type),
  ],
);

export const marketImpactAssessments = sqliteTable(
  "market_impact_assessments",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => intelligenceEvents.id, { onDelete: "cascade" }),
    assetId: text("asset_id").notNull().references(() => marketAssets.id, { onDelete: "cascade" }),
    exposureConfidence: integer("exposure_confidence").notNull(),
    relationshipConfidence: integer("relationship_confidence").notNull(),
    marketAnomalyScore: integer("market_anomaly_score").notNull(),
    causalConfidence: integer("causal_confidence").notNull(),
    measurements: text("measurements", { mode: "json" }).$type<Record<string, number | null>>().notNull(),
    supportingReportIds: text("supporting_report_ids", { mode: "json" }).$type<string[]>().notNull(),
    contradictingReportIds: text("contradicting_report_ids", { mode: "json" }).$type<string[]>().notNull(),
    explanation: text("explanation").notNull(),
    analystState: text("analyst_state").notNull(),
    calculatedAt: text("calculated_at").notNull(),
    modelVersion: text("model_version").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [
    uniqueIndex("market_impacts_event_asset_unique").on(table.eventId, table.assetId),
    index("market_impacts_review_idx").on(table.analystState, table.marketAnomalyScore),
    check("market_impacts_scores_check", sql`${table.exposureConfidence} between 0 and 100 and ${table.relationshipConfidence} between 0 and 100 and ${table.marketAnomalyScore} between 0 and 100 and ${table.causalConfidence} between 0 and 100`),
  ],
);

export const intelligenceStateHistory = sqliteTable(
  "intelligence_state_history",
  {
    id: text("id").primaryKey(),
    occurredAt: text("occurred_at").notNull(),
    type: text("type").notNull(),
    eventId: text("event_id").references(() => intelligenceEvents.id, { onDelete: "set null" }),
    relationshipId: text("relationship_id").references(() => intelligenceRelationships.id, { onDelete: "set null" }),
    marketAssessmentId: text("market_assessment_id").references(() => marketImpactAssessments.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    before: text("before", { mode: "json" }).$type<Record<string, unknown>>(),
    after: text("after", { mode: "json" }).$type<Record<string, unknown>>(),
    reportIds: text("report_ids", { mode: "json" }).$type<string[]>().notNull(),
    actor: text("actor").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
  },
  (table) => [index("state_history_time_idx").on(table.occurredAt), index("state_history_event_idx").on(table.eventId, table.occurredAt)],
);

export const conflictProfiles = sqliteTable(
  "conflict_profiles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    countries: text("countries", { mode: "json" }).$type<string[]>().notNull(),
    regions: text("regions", { mode: "json" }).$type<string[]>().notNull(),
    startDate: text("start_date").notNull(),
    currentPhase: text("current_phase").notNull(),
    profile: text("profile", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    updatedAt: text("updated_at").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [uniqueIndex("conflict_profiles_slug_unique").on(table.slug), index("conflict_profiles_updated_idx").on(table.updatedAt)],
);

export const publicCameraSources = sqliteTable(
  "public_camera_sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    operator: text("operator").notNull(),
    sourceUrl: text("source_url").notNull(),
    embedUrl: text("embed_url"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    location: text("location").notNull(),
    country: text("country").notNull(),
    category: text("category").notNull(),
    usageInformation: text("usage_information").notNull(),
    attributionRequirements: text("attribution_requirements").notNull(),
    embedPermission: text("embed_permission").notNull(),
    lastSuccessfulCheck: text("last_successful_check"),
    availability: text("availability").notNull(),
    relationships: text("relationships", { mode: "json" }).$type<Record<string, string[]>>().notNull(),
    refreshIntervalSeconds: integer("refresh_interval_seconds").notNull(),
    accessRestrictions: text("access_restrictions", { mode: "json" }).$type<string[]>().notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [
    uniqueIndex("camera_sources_url_unique").on(table.sourceUrl),
    index("camera_sources_availability_idx").on(table.availability, table.category),
    check("camera_sources_coordinates_check", sql`${table.latitude} between -90 and 90 and ${table.longitude} between -180 and 180`),
    check("camera_sources_refresh_check", sql`${table.refreshIntervalSeconds} between 30 and 86400`),
  ],
);

export const alertHistory = sqliteTable(
  "alert_history",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    priority: text("priority").notNull(),
    state: text("state").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    voiceMessage: text("voice_message").notNull(),
    eventId: text("event_id").references(() => intelligenceEvents.id, { onDelete: "set null" }),
    relationshipId: text("relationship_id").references(() => intelligenceRelationships.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
    acknowledgedAt: text("acknowledged_at"),
    dismissedAt: text("dismissed_at"),
    deduplicationKey: text("deduplication_key").notNull(),
    cooldownSeconds: integer("cooldown_seconds").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [index("alert_history_state_idx").on(table.state, table.priority, table.createdAt), index("alert_history_dedup_idx").on(table.deduplicationKey, table.createdAt)],
);

export const monitoringLayouts = sqliteTable(
  "monitoring_layouts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    widgets: text("widgets", { mode: "json" }).$type<Record<string, unknown>[]>().notNull(),
    updatedAt: text("updated_at").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
    demoDataLabel: text("demo_data_label").notNull(),
  },
  (table) => [uniqueIndex("monitoring_layouts_owner_name_unique").on(table.ownerId, table.name)],
);

/**
 * Materialized API documents used by the standalone Worker. The normalized
 * tables above remain available for filtering and joins, while this table lets
 * the static Pages client consume complete, versioned domain records without
 * losing fields as the read model evolves.
 */
export const intelligenceReadModels = sqliteTable(
  "intelligence_read_models",
  {
    id: text("id").primaryKey(),
    collection: text("collection").notNull(),
    recordId: text("record_id").notNull(),
    slug: text("slug"),
    document: text("document", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    version: integer("version").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
    dataClassification: text("data_classification").notNull().default("demonstration"),
  },
  (table) => [
    uniqueIndex("intelligence_read_models_collection_record_unique").on(
      table.collection,
      table.recordId,
    ),
    uniqueIndex("intelligence_read_models_collection_slug_unique").on(
      table.collection,
      table.slug,
    ),
    index("intelligence_read_models_collection_updated_idx").on(
      table.collection,
      table.sortOrder,
      table.updatedAt,
    ),
    check("intelligence_read_models_version_check", sql`${table.version} >= 1`),
  ],
);

export type IntelligenceSourceRow = typeof intelligenceSources.$inferSelect;
export type SourceReportRow = typeof sourceReports.$inferSelect;
export type IntelligenceEventRow = typeof intelligenceEvents.$inferSelect;
export type IntelligenceClaimRow = typeof intelligenceClaims.$inferSelect;
export type AnalystReviewRow = typeof analystReviews.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type CollectorRunRow = typeof collectorRuns.$inferSelect;
export type IntelligenceReadModelRow = typeof intelligenceReadModels.$inferSelect;
export type AuthUserRow = typeof authUsers.$inferSelect;
export type AuthUserRoleRow = typeof authUserRoles.$inferSelect;
export type AuthSessionRow = typeof authSessions.$inferSelect;
