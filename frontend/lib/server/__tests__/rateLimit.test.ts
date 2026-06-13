import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { rateLimit, resetRateLimits, getClientIp } from '../rateLimit'
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
