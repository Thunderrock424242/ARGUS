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
