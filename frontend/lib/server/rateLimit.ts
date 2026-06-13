import 'server-only';
import { NextResponse } from 'next/server';
import {
  clearMemoryHits,
  getRateLimitStore,
  type RateLimitResult,
  rateLimitSync,
  resetRateLimitStore,
} from './rateLimitStore';

/**
 * Sliding-window rate limiter (SPECS §19) over a PLUGGABLE backend.
 *
 * The actual window check lives in a `RateLimitStore` (see `rateLimitStore.ts`),
 * selected at runtime from the environment:
 *
 *  - DEFAULT (zero-config): an in-memory, per-process store. Exact on a single
 *    instance; across a multi-instance serverless deploy each instance keeps its
 *    own window, so the effective global limit scales with instance count.
 *  - SHARED: an Upstash Redis store enforcing a strict GLOBAL limit, activated
 *    when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
 *    It runs a single atomic sorted-set Lua script and FAILS OPEN on error.
 *
 * `enforceRateLimit` is async because the store check is async. The synchronous
 * `rateLimit()` helper below operates directly on the in-memory store and is
 * retained for tests and any caller that wants the per-process semantics.
 */

export type { RateLimitResult };

/**
 * Synchronous sliding-window check against the in-memory store. Records a hit
 * for `key` and reports whether it is within `limit` requests per `windowMs`.
 * Pure aside from the module-level store and Date.now(). Note: this always uses
 * the in-memory backend regardless of env — use `enforceRateLimit` to honor the
 * configured (possibly shared) store.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  return rateLimitSync(key, limit, windowMs);
}

/** Clears all recorded hits and the cached store selection — for tests. */
export function resetRateLimits(): void {
  clearMemoryHits();
  resetRateLimitStore();
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const headers = (req as { headers?: Headers }).headers;
  if (!headers || typeof headers.get !== 'function') return 'unknown';
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

export interface EnforceOptions {
  /** Logical bucket name so different route groups have independent windows. */
  bucket: string;
  limit: number;
  windowMs?: number; // defaults to 60_000 (1 minute)
}

/**
 * Enforces a per-IP rate limit for a request against the configured store.
 * Returns a ready 429 response when the limit is exceeded, or null to proceed.
 * Usage:
 *
 *   const limited = await enforceRateLimit(req, { bucket: 'positions', limit: 60 })
 *   if (limited) return limited
 */
export async function enforceRateLimit(
  req: Request,
  opts: EnforceOptions,
): Promise<NextResponse | null> {
  const windowMs = opts.windowMs ?? 60_000;
  const ip = getClientIp(req);
  const result = await getRateLimitStore().hit(`${opts.bucket}:${ip}`, opts.limit, windowMs);
  if (result.ok) return null;

  return NextResponse.json(
    { error: 'Rate limit exceeded. Please slow down and try again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}
