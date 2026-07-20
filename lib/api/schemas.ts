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
  analystState: z.enum(["needs-review", "confirmed", "rejected", "disputed"]),
  reviewerName: analystNameSchema,
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
  reviewerName: analystNameSchema,
  name: z.string().trim().min(1).max(120),
  widgets: z.array(monitoringWidgetSchema).max(60),
}).strict();

export const alertActionRequestSchema = z.object({
  action: z.enum(["acknowledge", "dismiss"]),
  reviewerName: analystNameSchema,
}).strict();

export const demoSeedRequestSchema = z.object({
  reviewerName: analystNameSchema,
  confirmation: z.literal("seed-demonstration-data"),
}).strict();

export const retentionRequestSchema = z.object({
  reviewerName: analystNameSchema,
  before: dateTime,
  collections: z.array(z.enum(["reports", "relationship-history", "state-history", "alerts"])).min(1).max(4).optional(),
}).strict();
