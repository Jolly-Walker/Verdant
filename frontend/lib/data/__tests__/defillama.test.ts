import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { findPoolApy, resetDefillamaCache } from '../defillama'

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response
}

describe('findPoolApy', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetDefillamaCache()
  })

  it('returns the highest-TVL match with real supply and borrow APYs', async () => {
    const pools = {
      data: [
        {
          pool: 'pool-small',
          project: 'euler-v2',
          chain: 'Ethereum',
          symbol: 'USDC',
          apy: 3.0,
          tvlUsd: 1_000_000,
          totalSupplyUsd: 1_000_000,
          totalBorrowUsd: 500_000,
        },
        {
          pool: 'pool-big',
          project: 'euler-v2',
          chain: 'Ethereum',
          symbol: 'USDC',
          apy: 4.5,
          tvlUsd: 9_000_000,
          totalSupplyUsd: 9_000_000,
          totalBorrowUsd: 4_500_000,
        },
      ],
    }
    const borrow = { data: [{ pool: 'pool-big', apyBaseBorrow: 6.2 }] }

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockImplementation((url: string | URL | Request) => {
        const u = String(url)
        return Promise.resolve(jsonResponse(u.includes('poolsBorrow') ? borrow : pools))
      })

    const result = await findPoolApy('euler-v2', 'Ethereum', 'USDC')

    expect(result).not.toBeNull()
    expect(result?.poolId).toBe('pool-big')
    expect(result?.apy).toBeCloseTo(0.045, 6) // 4.5% → decimal
    expect(result?.borrowApyDecimal).toBeCloseTo(0.062, 6) // 6.2% → decimal
    expect(result?.utilisationDecimal).toBeCloseTo(0.5, 6)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('returns null when no pool matches the protocol/chain/asset', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url: string | URL | Request) => {
      const u = String(url)
      return Promise.resolve(
        jsonResponse(u.includes('poolsBorrow') ? { data: [] } : { data: [] })
      )
    })

    const result = await findPoolApy('euler-v2', 'Ethereum', 'USDC')
    expect(result).toBeNull()
  })
})
