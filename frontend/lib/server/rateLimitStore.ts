import 'server-only';
import { getServerEnv } from './env';

/**
 * Pluggable rate-limit backends (SPECS §19).
 *
 * A `RateLimitStore` performs one atomic sliding-window check per call:
 * record a hit for `key` and report whether it is within `limit` requests per
 * `windowMs`. Two implementations are provided:
 *
 *  - {@link InMemoryRateLimitStore} — the zero-config default. Per-process, so
 *    exact on a single instance but per-instance across a multi-instance
 *    deploy. Preserves the original sliding-window semantics exactly.
 *  - {@link UpstashRateLimitStore} — a shared store backed by Upstash Redis,
 *    enforcing a strict GLOBAL limit across instances. Activated only when both
 *    `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. The check
 *    is a single Redis sorted-set Lua script (ZREMRANGEBYSCORE + ZCARD +
 *    conditional ZADD + PEXPIRE) so it is correct under concurrency. On any
 *    Upstash error it FAILS OPEN (returns ok) — consistent with the codebase's
 *    fail-open rate-limit/RPC philosophy; the simulation gate and other guards
 *    are the real backstop.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the caller may retry (only meaningful when !ok). */
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

type Timestamps = number[];

/**
 * The shared module-level store for the in-memory backend. Kept at module scope
 * (not per-instance-of-class) so the synchronous `rateLimit()` helper and
 * `resetRateLimits()` in `rateLimit.ts` operate on the same data.
 */
const memoryHits = new Map<string, Timestamps>();

/**
 * Idle-key eviction. Per-key timestamp arrays are pruned on every hit, but a key
 * that is hit once and never again would otherwise persist FOREVER — across
 * millions of distinct `bucket:ip` keys (trivially so if the IP is spoofable)
 * the Map grows unbounded until the process OOMs. So we amortize a sweep that
 * drops keys idle longer than any window in use.
 */
const SWEEP_INTERVAL_MS = 60_000; // sweep at most once per minute
// Generously larger than any rate-limit window this app uses (≤ 60s): a key
// whose newest hit is older than this is past its window, so the next hit would
// re-prune to empty anyway — deleting it now changes no rate-limit decision.
const IDLE_TTL_MS = 5 * 60_000;
const MAX_TRACKED_KEYS = 50_000; // hard backstop forcing a sweep under abuse

let lastSweepAt = 0;

function sweepIdleKeys(now: number): void {
  const cutoff = now - IDLE_TTL_MS;
  for (const [key, timestamps] of memoryHits) {
    // timestamps are appended in increasing time order, so the last is newest.
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
      memoryHits.delete(key);
    }
  }
}

/** Clears all recorded in-memory hits and sweep state — for tests. */
export function clearMemoryHits(): void {
  memoryHits.clear();
  lastSweepAt = 0;
}

/** Current number of tracked keys — for tests/observability. */
export function memoryHitsSize(): number {
  return memoryHits.size;
}

/**
 * Synchronous sliding-window check against the in-memory store. This is the
 * original `rateLimit()` algorithm, factored out so both the sync test path and
 * the async {@link InMemoryRateLimitStore} share identical semantics.
 */
export function rateLimitSync(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Amortized cleanup so idle keys cannot accumulate across the process lifetime.
  if (now - lastSweepAt > SWEEP_INTERVAL_MS || memoryHits.size > MAX_TRACKED_KEYS) {
    sweepIdleKeys(now);
    lastSweepAt = now;
  }

  const windowStart = now - windowMs;
  const recent = (memoryHits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= limit) {
    memoryHits.set(key, recent);
    const oldest = recent[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  recent.push(now);
  memoryHits.set(key, recent);
  return { ok: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
}

export class InMemoryRateLimitStore implements RateLimitStore {
  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    return rateLimitSync(key, limit, windowMs);
  }
}

/**
 * Atomic sliding-window over a Redis sorted set. Members are unique per hit
 * (`<now>-<random>`), scored by millisecond timestamp. The script:
 *   1. drops entries older than the window,
 *   2. counts what remains,
 *   3. if under the limit, adds the new hit,
 *   4. sets the key to expire after the window so idle keys are reclaimed,
 *   5. returns {count, oldestScore} so the caller can derive remaining/retry.
 *
 * `count` is the number of in-window hits AFTER the conditional add (i.e. it
 * includes the current request when admitted, and excludes it when rejected),
 * matching the in-memory store's accounting.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
local admitted = 0
if count < limit then
  redis.call('ZADD', key, now, member)
  count = count + 1
  admitted = 1
end
redis.call('PEXPIRE', key, window)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = -1
if oldest[2] ~= nil then
  oldestScore = tonumber(oldest[2])
end
return {admitted, count, oldestScore}
`.trim();

interface UpstashCommandResult {
  result?: unknown;
  error?: string;
}

export class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const member = `${now}-${Math.random().toString(36).slice(2)}`;

    try {
      // Upstash REST: EVAL <script> <numkeys> <keys...> <args...> as a JSON array.
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          'EVAL',
          SLIDING_WINDOW_LUA,
          '1',
          key,
          String(now),
          String(windowMs),
          String(limit),
          member,
        ]),
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Upstash HTTP ${res.status}`);
      }

      const body = (await res.json()) as UpstashCommandResult;
      if (body.error) {
        throw new Error(body.error);
      }

      const tuple = body.result;
      if (!Array.isArray(tuple) || tuple.length < 3) {
        throw new Error('Unexpected Upstash response shape');
      }

      const admitted = Number(tuple[0]) === 1;
      const count = Number(tuple[1]);
      const oldestScore = Number(tuple[2]);

      if (admitted) {
        return { ok: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
      }

      const retryAfterSeconds =
        oldestScore >= 0
          ? Math.max(1, Math.ceil((oldestScore + windowMs - now) / 1000))
          : Math.max(1, Math.ceil(windowMs / 1000));
      return { ok: false, remaining: 0, retryAfterSeconds };
    } catch (err) {
      // Fail open: never block a request because the shared store is unreachable.
      console.error('[rateLimit] Upstash store error, failing open:', err);
      return { ok: true, remaining: limit, retryAfterSeconds: 0 };
    }
  }
}

let cachedStore: RateLimitStore | null = null;

/**
 * Selects the rate-limit backend at runtime: the Upstash shared store when both
 * `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present, otherwise
 * the in-memory default. The choice is cached for the process lifetime.
 */
export function getRateLimitStore(): RateLimitStore {
  if (cachedStore) return cachedStore;

  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = getServerEnv();
  cachedStore = url && token ? new UpstashRateLimitStore(url, token) : new InMemoryRateLimitStore();
  return cachedStore;
}

/** Resets the cached store selection — for tests. */
export function resetRateLimitStore(): void {
  cachedStore = null;
}
