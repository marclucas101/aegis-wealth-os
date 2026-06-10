import "server-only";

/**
 * Lightweight in-memory sliding-window rate limiter for MVP / dev / single-instance preview.
 *
 * WARNING: This store is per-process and NOT shared across serverless instances, containers,
 * or horizontal scale-out. Replace with Redis / edge rate limiting before multi-instance production.
 */

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export type RateLimitCheckResult =
  | { limited: false; remaining: number; resetAt: number }
  | { limited: true; retryAfterMs: number; resetAt: number };

type BucketEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, BucketEntry>();

/** Preset buckets used by API route guards. */
export const RATE_LIMIT_PRESETS = {
  /** Write-heavy mutations (saves, uploads, admin actions). */
  writeHeavy: { windowMs: 60_000, maxRequests: 30 },
  /** Consolidated dashboard reads (command-center). */
  commandCenter: { windowMs: 60_000, maxRequests: 120 },
  /** Public health probe — strict per-IP cap. */
  health: { windowMs: 60_000, maxRequests: 20 },
} as const satisfies Record<string, RateLimitConfig>;

let checksSinceCleanup = 0;

function pruneExpiredEntries(now: number): void {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function maybeCleanup(now: number): void {
  checksSinceCleanup += 1;
  if (checksSinceCleanup >= 100) {
    checksSinceCleanup = 0;
    pruneExpiredEntries(now);
  }
}

/**
 * Checks whether a request key is within the configured window.
 * Does not increment when limited — caller should only call once per request.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitCheckResult {
  const now = Date.now();
  maybeCleanup(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      limited: false,
      remaining: Math.max(0, config.maxRequests - 1),
      resetAt,
    };
  }

  if (existing.count >= config.maxRequests) {
    return {
      limited: true,
      retryAfterMs: Math.max(0, existing.resetAt - now),
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return {
    limited: false,
    remaining: Math.max(0, config.maxRequests - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Builds a namespaced rate-limit key for a route bucket + actor. */
export function buildRateLimitKey(
  bucket: string,
  actorKey: string,
): string {
  return `${bucket}:${actorKey}`;
}
