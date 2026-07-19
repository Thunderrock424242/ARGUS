export interface RateLimitStore {
  increment(key: string, windowStartedAt: number, expiresAt: number): Promise<number>;
}

interface MemoryCounter {
  count: number;
  windowStartedAt: number;
  expiresAt: number;
}

/** Development-only store. Production should use the same contract with D1 or Durable Objects. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, MemoryCounter>();

  async increment(key: string, windowStartedAt: number, expiresAt: number): Promise<number> {
    const current = this.counters.get(key);
    if (!current || current.expiresAt <= windowStartedAt || current.windowStartedAt !== windowStartedAt) {
      this.counters.set(key, { count: 1, windowStartedAt, expiresAt });
      this.prune(windowStartedAt);
      return 1;
    }
    current.count += 1;
    return current.count;
  }

  private prune(now: number): void {
    if (this.counters.size < 1_000) return;
    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now) this.counters.delete(key);
    }
  }
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export class FixedWindowRateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly limit: number,
    private readonly windowMs: number,
  ) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Rate limit must be positive.");
    if (!Number.isInteger(windowMs) || windowMs < 1_000) {
      throw new Error("Rate-limit window must be at least one second.");
    }
  }

  async check(key: string, now = Date.now()): Promise<RateLimitDecision> {
    const windowStartedAt = Math.floor(now / this.windowMs) * this.windowMs;
    const resetAt = windowStartedAt + this.windowMs;
    const count = await this.store.increment(key, windowStartedAt, resetAt);
    return {
      allowed: count <= this.limit,
      limit: this.limit,
      remaining: Math.max(0, this.limit - count),
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1_000)),
    };
  }
}

export function rateLimitHeaders(decision: RateLimitDecision): HeadersInit {
  return {
    "ratelimit-limit": String(decision.limit),
    "ratelimit-remaining": String(decision.remaining),
    "ratelimit-reset": String(Math.ceil(decision.resetAt / 1_000)),
    ...(decision.allowed ? {} : { "retry-after": String(decision.retryAfterSeconds) }),
  };
}

export function requestRateLimitKey(request: Request, scope: string): string {
  const cloudflareAddress = request.headers.get("cf-connecting-ip");
  const client =
    cloudflareAddress && /^[0-9a-f:.]{2,64}$/i.test(cloudflareAddress)
      ? cloudflareAddress.toLocaleLowerCase("en-US")
      : "unidentified-client";
  return `${scope}:${client}`;
}

export const adminRateLimiter = new FixedWindowRateLimiter(
  new MemoryRateLimitStore(),
  20,
  60_000,
);
