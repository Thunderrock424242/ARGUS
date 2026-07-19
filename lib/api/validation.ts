import { z } from "zod";
import type { ApiErrorDetail } from "./responses";

export type ValidationResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      status: 400 | 413 | 415 | 422;
      code: string;
      message: string;
      details?: ApiErrorDetail[];
    };

function issueDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : undefined,
    message: issue.message,
  }));
}

export function searchParamsRecord(searchParams: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}

export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodType<T>,
): ValidationResult<T> {
  const parsed = schema.safeParse(searchParamsRecord(searchParams));
  if (!parsed.success) {
    return {
      success: false,
      status: 422,
      code: "invalid_query",
      message: "The query parameters are invalid.",
      details: issueDetails(parsed.error),
    };
  }
  return { success: true, data: parsed.data };
}

function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US");
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

export async function validateJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maximumBytes = 32_768,
): Promise<ValidationResult<T>> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      success: false,
      status: 415,
      code: "unsupported_media_type",
      message: "Requests to this endpoint must use application/json.",
    };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    return {
      success: false,
      status: 413,
      code: "payload_too_large",
      message: `The request body exceeds the ${maximumBytes}-byte limit.`,
    };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    return {
      success: false,
      status: 413,
      code: "payload_too_large",
      message: `The request body exceeds the ${maximumBytes}-byte limit.`,
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      success: false,
      status: 400,
      code: "invalid_json",
      message: "The request body is not valid JSON.",
    };
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      status: 422,
      code: "invalid_body",
      message: "The request body failed validation.",
      details: issueDetails(parsed.error),
    };
  }
  return { success: true, data: parsed.data };
}

export const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);
export const limitSchema = z.coerce.number().int().min(1).max(100).default(25);

export const queryBooleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
