import 'server-only'
import { NextResponse } from 'next/server'

/**
 * In-memory sliding-window rate limiter (SPECS §19).
 *
 * NOTE: this is per-process. On a single instance it is exact; across a
 * multi-instance serverless deployment (e.g. Vercel) each instance keeps its
 * own window, so the effective global limit scales with instance count. For
 * strict global limits, swap the `hits` store for a shared backend (e.g.
 * Upstash Redis) behind the same `rateLimit()` signature.
 */

type Timestamps = number[]
const hits = new Map<string, Timestamps>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Seconds until the caller may retry (only meaningful when !ok). */
  retryAfterSeconds: number
}

/**
 * Records a hit for `key` and reports whether it is within `limit` requests per
 * `windowMs`. Pure aside from the module-level store and Date.now().
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowMs
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart)

  if (recent.length >= limit) {
    hits.set(key, recent)
    const oldest = recent[0]
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  recent.push(now)
  hits.set(key, recent)
  return { ok: true, remaining: limit - recent.length, retryAfterSeconds: 0 }
}

/** Clears all recorded hits — for tests. */
export function resetRateLimits(): void {
  hits.clear()
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const headers = (req as { headers?: Headers }).headers
  if (!headers || typeof headers.get !== 'function') return 'unknown'
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}

export interface EnforceOptions {
  /** Logical bucket name so different route groups have independent windows. */
  bucket: string
  limit: number
  windowMs?: number // defaults to 60_000 (1 minute)
}

/**
 * Enforces a per-IP rate limit for a request. Returns a ready 429 response when
 * the limit is exceeded, or null to proceed. Usage:
 *
 *   const limited = enforceRateLimit(req, { bucket: 'positions', limit: 60 })
 *   if (limited) return limited
 */
export function enforceRateLimit(req: Request, opts: EnforceOptions): NextResponse | null {
  const windowMs = opts.windowMs ?? 60_000
  const ip = getClientIp(req)
  const result = rateLimit(`${opts.bucket}:${ip}`, opts.limit, windowMs)
  if (result.ok) return null

  return NextResponse.json(
    { error: 'Rate limit exceeded. Please slow down and try again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
  )
}
