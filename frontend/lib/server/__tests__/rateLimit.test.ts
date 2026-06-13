import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { rateLimit, resetRateLimits, getClientIp, enforceRateLimit } from '../rateLimit'
import { NextRequest } from 'next/server'

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('allows up to the limit then blocks', () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('k', 3, 60_000).ok).toBe(true)
    }
    const blocked = rateLimit('k', 3, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('isolates limits per key', () => {
    expect(rateLimit('a', 1, 60_000).ok).toBe(true)
    expect(rateLimit('a', 1, 60_000).ok).toBe(false)
    expect(rateLimit('b', 1, 60_000).ok).toBe(true)
  })

  it('frees capacity once the window slides past old hits', () => {
    expect(rateLimit('k', 1, 60_000).ok).toBe(true)
    expect(rateLimit('k', 1, 60_000).ok).toBe(false)
    vi.advanceTimersByTime(60_001)
    expect(rateLimit('k', 1, 60_000).ok).toBe(true)
  })

  it('reports decreasing remaining capacity', () => {
    expect(rateLimit('k', 2, 60_000).remaining).toBe(1)
    expect(rateLimit('k', 2, 60_000).remaining).toBe(0)
  })
})

describe('getClientIp', () => {
  it('reads the first x-forwarded-for entry', () => {
    const req = new NextRequest(new URL('http://localhost/x'), {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to unknown when no header is present', () => {
    const req = new NextRequest(new URL('http://localhost/x'))
    expect(getClientIp(req)).toBe('unknown')
  })
})

describe('enforceRateLimit (async, in-memory store)', () => {
  beforeEach(() => {
    // No UPSTASH_* env vars set in the test environment, so this exercises the
    // in-memory backend with no live network.
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    resetRateLimits()
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
  })
  afterEach(() => vi.useRealTimers())

  const reqFromIp = (ip: string) =>
    new NextRequest(new URL('http://localhost/x'), {
      headers: { 'x-forwarded-for': ip },
    })

  it('returns null until the limit is hit, then a 429 with Retry-After', async () => {
    const opts = { bucket: 'positions', limit: 2 }
    expect(await enforceRateLimit(reqFromIp('9.9.9.9'), opts)).toBeNull()
    expect(await enforceRateLimit(reqFromIp('9.9.9.9'), opts)).toBeNull()

    const blocked = await enforceRateLimit(reqFromIp('9.9.9.9'), opts)
    expect(blocked).not.toBeNull()
    expect(blocked?.status).toBe(429)
    const retryAfter = Number(blocked?.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
  })

  it('isolates windows per IP and per bucket', async () => {
    expect(await enforceRateLimit(reqFromIp('1.1.1.1'), { bucket: 'simulate', limit: 1 })).toBeNull()
    // Same bucket, different IP — independent window.
    expect(await enforceRateLimit(reqFromIp('2.2.2.2'), { bucket: 'simulate', limit: 1 })).toBeNull()
    // Same IP, same bucket — now blocked.
    expect(await enforceRateLimit(reqFromIp('1.1.1.1'), { bucket: 'simulate', limit: 1 })).not.toBeNull()
    // Same IP, different bucket — independent window.
    expect(await enforceRateLimit(reqFromIp('1.1.1.1'), { bucket: 'positions', limit: 1 })).toBeNull()
  })

  it('frees capacity once the window slides past old hits', async () => {
    const opts = { bucket: 'simulate', limit: 1, windowMs: 60_000 }
    expect(await enforceRateLimit(reqFromIp('3.3.3.3'), opts)).toBeNull()
    expect(await enforceRateLimit(reqFromIp('3.3.3.3'), opts)).not.toBeNull()
    vi.advanceTimersByTime(60_001)
    expect(await enforceRateLimit(reqFromIp('3.3.3.3'), opts)).toBeNull()
  })
})
