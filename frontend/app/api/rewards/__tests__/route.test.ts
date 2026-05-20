import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

// Mock the protocol registry with two plugins — one with rewards, one without
vi.mock('@/lib/plugins/protocols', () => ({
  PROTOCOL_REGISTRY: {
    aave: {
      supportedChains: ['ethereum', 'arbitrum'],
      rewards: {
        fetchRewards: vi.fn(),
        buildClaimTx: vi.fn(),
      },
    },
    morpho: {
      supportedChains: ['ethereum', 'base'],
      rewards: {
        fetchRewards: vi.fn(),
        buildClaimTx: vi.fn(),
      },
    },
    pendle: {
      // No rewards — should be skipped
      supportedChains: ['ethereum'],
    },
  },
}))

import { GET } from '../route'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'

const WALLET = '0xabcdef1234567890abcdef1234567890abcdef12'

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/rewards')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

describe('GET /api/rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: each fetchRewards returns empty
    vi.mocked(PROTOCOL_REGISTRY.aave.rewards!.fetchRewards).mockResolvedValue([])
    vi.mocked(PROTOCOL_REGISTRY.morpho.rewards!.fetchRewards).mockResolvedValue([])
  })

  it('should return 400 for missing address', async () => {
    const req = makeRequest({})
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('should return 400 for invalid EVM address', async () => {
    const req = makeRequest({ address: 'not-an-address' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('should return empty rewards when all protocols return nothing', async () => {
    const req = makeRequest({ address: WALLET })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rewards).toEqual([])
    expect(body.totalUsd).toBe(0)
  })

  it('should aggregate rewards from multiple protocols and chains', async () => {
    vi.mocked(PROTOCOL_REGISTRY.aave.rewards!.fetchRewards).mockResolvedValue([
      { token: 'AAVE', amount: '10.0', amountUsd: 120 },
    ])
    vi.mocked(PROTOCOL_REGISTRY.morpho.rewards!.fetchRewards).mockResolvedValue([
      { token: 'MORPHO', amount: '50.0', amountUsd: 75 },
    ])

    const req = makeRequest({ address: WALLET })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    // Aave runs on ethereum + arbitrum → 2 calls, morpho on ethereum + base → 2 calls
    // Each non-empty call produces a reward entry tagged with protocol + chain
    expect(body.rewards.length).toBeGreaterThanOrEqual(2)
    expect(body.totalUsd).toBeGreaterThan(0)

    const aaveEntry = body.rewards.find((r: any) => r.token === 'AAVE')
    expect(aaveEntry).toBeDefined()
    expect(aaveEntry.protocol).toBe('aave')

    const morphoEntry = body.rewards.find((r: any) => r.token === 'MORPHO')
    expect(morphoEntry).toBeDefined()
    expect(morphoEntry.protocol).toBe('morpho')
  })

  it('should correctly sum totalUsd across all reward entries', async () => {
    vi.mocked(PROTOCOL_REGISTRY.aave.rewards!.fetchRewards).mockImplementation(
      async (addr, chain) => chain === 'ethereum'
        ? [{ token: 'AAVE', amount: '1', amountUsd: 100 }]
        : []
    )
    vi.mocked(PROTOCOL_REGISTRY.morpho.rewards!.fetchRewards).mockImplementation(
      async (addr, chain) => chain === 'ethereum'
        ? [{ token: 'MORPHO', amount: '1', amountUsd: 50 }]
        : []
    )

    const req = makeRequest({ address: WALLET })
    const res = await GET(req)
    const body = await res.json()

    expect(body.totalUsd).toBe(150)
  })

  it('should filter to a specific chain when chain query param is provided', async () => {
    vi.mocked(PROTOCOL_REGISTRY.aave.rewards!.fetchRewards).mockResolvedValue([
      { token: 'AAVE', amount: '1', amountUsd: 100 },
    ])

    const req = makeRequest({ address: WALLET, chain: 'ethereum' })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    // Only ethereum chain was fetched — all results should be on ethereum
    for (const r of body.rewards) {
      expect(r.chain).toBe('ethereum')
    }
  })

  it('should skip protocols without a rewards object (pendle in mock)', async () => {
    const req = makeRequest({ address: WALLET })
    const res = await GET(req)
    const body = await res.json()

    // pendle has no rewards, so its fetchRewards should never be called
    const pendlePlugin = (PROTOCOL_REGISTRY as any).pendle
    expect(pendlePlugin.rewards).toBeUndefined()
    // None of the results should be from pendle
    for (const r of body.rewards) {
      expect(r.protocol).not.toBe('pendle')
    }
  })

  it('should gracefully skip a protocol that throws an error', async () => {
    vi.mocked(PROTOCOL_REGISTRY.aave.rewards!.fetchRewards).mockRejectedValue(
      new Error('RPC timeout')
    )
    vi.mocked(PROTOCOL_REGISTRY.morpho.rewards!.fetchRewards).mockResolvedValue([
      { token: 'MORPHO', amount: '1', amountUsd: 20 },
    ])

    const req = makeRequest({ address: WALLET })
    const res = await GET(req)
    // Should still succeed despite aave throwing
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rewards.some((r: any) => r.token === 'MORPHO')).toBe(true)
  })
})
