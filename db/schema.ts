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

export type IntelligenceSourceRow = typeof intelligenceSources.$inferSelect;
export type SourceReportRow = typeof sourceReports.$inferSelect;
export type IntelligenceEventRow = typeof intelligenceEvents.$inferSelect;
export type IntelligenceClaimRow = typeof intelligenceClaims.$inferSelect;
export type AnalystReviewRow = typeof analystReviews.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type CollectorRunRow = typeof collectorRuns.$inferSelect;
