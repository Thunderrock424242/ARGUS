import { z } from "zod";
import { limitSchema, pageSchema, queryBooleanSchema } from "./validation";

export const EVENT_CATEGORIES = [
  "conflict",
  "political",
  "cyber",
  "disaster",
  "maritime",
  "aviation",
  "health",
  "infrastructure",
  "economic",
  "crime",
  "technology",
  "environment",
  "local",
  "other",
] as const;

export const EVENT_STATUSES = [
  "emerging",
  "developing",
  "active",
  "stable",
  "resolved",
  "disputed",
  "rejected",
] as const;

export const VERIFICATION_STATES = [
  "automated",
  "needs-review",
  "analyst-confirmed",
  "analyst-rejected",
  "disputed",
] as const;

const shortText = z.string().trim().min(1).max(200);
const dateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), "Must be a valid date-time.");

export const eventsQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    q: shortText.optional(),
    category: z.enum(EVENT_CATEGORIES).optional(),
    status: z.enum(EVENT_STATUSES).optional(),
    verificationState: z.enum(VERIFICATION_STATES).optional(),
    severity: z.coerce.number().int().min(1).max(5).optional(),
    minConfidence: z.coerce.number().int().min(0).max(99).optional(),
    region: z.string().trim().min(1).max(100).optional(),
    priority: queryBooleanSchema.optional(),
    sort: z.enum(["updated", "severity", "confidence"]).default("updated"),
  })
  .strict();

export const reportsQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    q: shortText.optional(),
    status: z
      .enum(["pending", "processing", "processed", "duplicate", "rejected", "failed"])
      .optional(),
    sourceId: z.string().trim().min(1).max(100).optional(),
    eventId: z.string().trim().min(1).max(100).optional(),
    countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
    dateFrom: dateTime.optional(),
    dateTo: dateTime.optional(),
  })
  .strict()
  .refine(
    (query) => !query.dateFrom || !query.dateTo || Date.parse(query.dateFrom) <= Date.parse(query.dateTo),
    { message: "dateFrom must not be later than dateTo.", path: ["dateFrom"] },
  );

export const sourcesQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    q: shortText.optional(),
    type: z.enum(["rss", "atom", "api", "webhook", "dataset"]).optional(),
    status: z.enum(["online", "degraded", "offline", "paused", "unknown"]).optional(),
    category: z.enum(EVENT_CATEGORIES).optional(),
    enabled: queryBooleanSchema.optional(),
  })
  .strict();

export const briefsQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    q: shortText.optional(),
    type: z.enum(["daily", "weekly", "custom"]).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .strict();

export const searchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(200),
    type: z.enum(["all", "event", "report", "source", "brief", "watchlist"]).default("all"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    category: z.enum(EVENT_CATEGORIES).optional(),
    region: z.string().trim().min(1).max(100).optional(),
    minConfidence: z.coerce.number().int().min(0).max(99).optional(),
    severity: z.coerce.number().int().min(1).max(5).optional(),
    verificationState: z.enum(VERIFICATION_STATES).optional(),
    sourceId: z.string().trim().min(1).max(100).optional(),
    dateFrom: dateTime.optional(),
    dateTo: dateTime.optional(),
  })
  .strict()
  .refine(
    (query) => !query.dateFrom || !query.dateTo || Date.parse(query.dateFrom) <= Date.parse(query.dateTo),
    { message: "dateFrom must not be later than dateTo.", path: ["dateFrom"] },
  );

export const routeIdentifierSchema = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

export const relationshipsQuerySchema = z.object({
  page: pageSchema,
  minConfidence: z.coerce.number().int().min(0).max(100).default(0),
  analystState: z.enum(["automated", "needs-review", "confirmed", "rejected", "disputed"]).optional(),
  relationshipType: z.enum(["confirmed-impact", "likely-impact", "possible-impact", "correlated-movement", "exposure-only", "hypothesized-consequence", "triggered-response", "escalated", "deescalated", "disrupted", "related-event", "disputed", "analyst-rejected"]).optional(),
  nodeId: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(250).default(100),
}).strict();

export const marketImpactsQuerySchema = z.object({
  minAnomaly: z.coerce.number().int().min(0).max(100).default(0),
  analystState: z.enum(["automated", "needs-review", "confirmed", "rejected", "disputed"]).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  assetId: z.string().trim().min(1).max(160).optional(),
}).strict();

const analystNameSchema = z.string().trim().min(1).max(100);

export const relationshipReviewRequestSchema = z.object({
  expectedVersion: z.number().int().min(1).optional(),
  analystState: z.enum(["needs-review", "confirmed", "rejected", "disputed"]),
  reviewerName: analystNameSchema.default("Deployment Operator"),
  reason: z.string().trim().min(3).max(2_000),
  analystNotes: z.string().trim().max(10_000).optional(),
  relationshipConfidence: z.number().int().min(0).max(100).optional(),
  exposureConfidence: z.number().int().min(0).max(100).optional(),
  causalConfidence: z.number().int().min(0).max(100).optional(),
}).strict();

const monitoringWidgetSchema = z.object({
  id: routeIdentifierSchema,
  type: z.enum(["map", "camera", "timeline", "impact-graph", "market-chart", "alert-stream", "regional-panel", "report-feed", "collector-status", "aether-brief", "conflict-profile", "watchlist-activity", "review-queue"]),
  title: z.string().trim().min(1).max(160),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(10_000),
  width: z.number().int().min(1).max(12),
  height: z.number().int().min(1).max(100),
  configuration: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
}).strict();

export const monitoringLayoutSaveSchema = z.object({
  expectedVersion: z.number().int().min(0).optional(),
  reviewerName: analystNameSchema.default("Deployment Operator"),
  name: z.string().trim().min(1).max(120),
  widgets: z.array(monitoringWidgetSchema).max(60),
}).strict();

export const alertActionRequestSchema = z.object({
  action: z.enum(["acknowledge", "dismiss"]),
  expectedVersion: z.number().int().min(1).optional(),
  reviewerName: analystNameSchema.default("Deployment Operator"),
}).strict();

export const auditLogQuerySchema = z.object({
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(100).default(25),
  targetId: routeIdentifierSchema.optional(),
}).strict();

export const ingestionQuerySchema = z.object({
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["needs-review", "duplicate", "approved", "rejected", "failed"]).optional(),
  sourceId: routeIdentifierSchema.optional(),
}).strict();

export const ingestionSubmissionSchema = z.object({
  sourceId: routeIdentifierSchema,
  externalId: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/).optional(),
  url: z.string().url().max(2_048),
  title: z.string().trim().min(5).max(240),
  description: z.string().trim().max(2_000).optional(),
  bodyText: z.string().trim().max(20_000).optional(),
  author: z.string().trim().max(160).optional(),
  language: z.string().trim().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).default("en"),
  publishedAt: dateTime,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  category: z.enum(EVENT_CATEGORIES).optional(),
  attribution: z.string().trim().max(500).optional(),
  provenanceNotes: z.string().trim().max(2_000).optional(),
}).strict().refine(
  (input) => (input.latitude === undefined) === (input.longitude === undefined),
  { message: "Latitude and longitude must be supplied together.", path: ["latitude"] },
);

export const ingestionReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(3).max(2_000),
  expectedVersion: z.number().int().min(1),
  eventId: routeIdentifierSchema.optional(),
  confidenceOverride: z.number().int().min(0).max(99).optional(),
}).strict();

export const ingestionConfidenceSchema = z.object({
  confidence: z.number().int().min(0).max(99),
  reason: z.string().trim().min(3).max(2_000),
  expectedVersion: z.number().int().min(1),
}).strict();

export const ingestionRetrySchema = z.object({
  reason: z.string().trim().min(3).max(2_000),
  expectedVersion: z.number().int().min(1),
}).strict();

export const demoSeedRequestSchema = z.object({
  reviewerName: analystNameSchema.default("Deployment Operator"),
  confirmation: z.literal("seed-demonstration-data"),
}).strict();

export const retentionRequestSchema = z.object({
  reviewerName: analystNameSchema.default("Deployment Operator"),
  before: dateTime,
  collections: z.array(z.enum(["reports", "relationship-history", "state-history", "alerts"])).min(1).max(4).optional(),
}).strict();
