import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { simulateTransaction } from '../simulate'
import { getPublicClient } from '@/lib/server/rpc'

vi.mock('@/lib/server/rpc', () => ({
  getRpcUrl: vi.fn().mockReturnValue('https://mock-rpc.com'),
  getPublicClient: vi.fn(),
  getSolanaConnection: vi.fn()
}))

describe('Simulation Integration', () => {
  const mockClient = {
    request: vi.fn()
  }

  beforeEach(() => {
    vi.mocked(getPublicClient).mockReturnValue(mockClient as any)
    vi.clearAllMocks()
  })

  it('successfully simulates an EVM transaction with asset changes', async () => {
    mockClient.request.mockResolvedValueOnce({
      gasUsed: '21000',
      assetChanges: [
        {
          from: '0x1234567890123456789012345678901234567890',
          to: '0x0987654321098765432109876543210987654321',
          rawAmount: '1000000',
          symbol: 'USDC',
          decimals: 6,
          contractAddress: '0xusdc'
        }
      ]
    })

    const result = await simulateTransaction({
      chain: 'ethereum',
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      data: '0x',
      value: '0'
    })

    expect(result.success).toBe(true)
    expect(result.gasEstimate).toBe(21000n)
    expect(result.stateChanges).toHaveLength(1)
    expect(result.stateChanges![0]).toEqual({
      asset: 'USDC',
      assetAddress: '0xusdc',
      change: '-1',
      type: 'balance',
      decimals: 6,
      chainId: 'ethereum'
    })
  })

  it('handles simulation revert with error decoding', async () => {
    mockClient.request.mockResolvedValueOnce({
      error: '0x13be252b' // Insufficient allowance
    })

    const result = await simulateTransaction({
      chain: 'ethereum',
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      data: '0x',
      value: '0'
    })

    expect(result.success).toBe(false)
    expect(result.revertReason).toContain('allowance')
  })
})
