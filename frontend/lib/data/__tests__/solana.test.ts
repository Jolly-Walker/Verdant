// frontend/lib/data/__tests__/solana.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock server-only before other imports
vi.mock('server-only', () => ({}))

import { fetchSolanaTokenBalances } from '../solana'

vi.mock('@/lib/server/solana', () => ({
  getSolanaConnection: vi.fn(() => ({
    getBalance: vi.fn().mockResolvedValue(1e9),
    getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] })
  }))
}))

vi.mock('../prices', () => ({
  fetchTokenPrices: vi.fn().mockResolvedValue({})
}))

describe('fetchSolanaTokenBalances', () => {
  it('is defined', () => {
    expect(fetchSolanaTokenBalances).toBeDefined()
  })

  it('fetches SOL and SPL token balances', async () => {
    const address = 'vines1vzrYbzLMRdu58syvpk9H76B4T12zDkC7y3R84'
    const positions = await fetchSolanaTokenBalances(address)
    
    expect(positions).toBeDefined()
    expect(positions.length).toBeGreaterThan(0)
    expect(positions[0].asset).toBe('SOL')
    expect(positions[0].chain).toBe('solana')
  })
})
