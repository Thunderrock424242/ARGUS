const SENSITIVE_KEY_PATTERN =
  /(?:authorization|cookie|token|secret|password|passphrase|api[-_]?key|private[-_]?key)/i;

export const API_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  requestId?: string;
}

function redactForJson(value: unknown, seen: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const result = value.map((item) => redactForJson(item, seen));
    seen.delete(value);
    return result;
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : redactForJson(item, seen);
    }
    seen.delete(value);
    return result;
  }
  return String(value);
}

/**
 * Produces JSON without accidentally serializing common credential fields.
 * Callers must still avoid putting secrets in response models in the first place.
 */
export function safeJsonValue(value: unknown): unknown {
  return redactForJson(value, new WeakSet<object>());
}

export function jsonResponse(
  payload: unknown,
  init: ResponseInit & { headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(API_SECURITY_HEADERS);
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(safeJsonValue(payload)), {
    ...init,
    headers,
  });
}

export function jsonData<T>(
  data: T,
  options: {
    status?: number;
    meta?: Record<string, unknown>;
    headers?: HeadersInit;
  } = {},
): Response {
  return jsonResponse(
    options.meta ? { data, meta: options.meta } : { data },
    { status: options.status ?? 200, headers: options.headers },
  );
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  options: {
    details?: ApiErrorDetail[];
    requestId?: string;
    headers?: HeadersInit;
  } = {},
): Response {
  const payload: ApiErrorPayload = {
    error: {
      code,
      message,
      ...(options.details?.length ? { details: options.details } : {}),
    },
    ...(options.requestId ? { requestId: options.requestId } : {}),
  };
  return jsonResponse(payload, { status, headers: options.headers });
}

export function requestIdFrom(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  if (incoming && /^[A-Za-z0-9_-]{1,80}$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}
