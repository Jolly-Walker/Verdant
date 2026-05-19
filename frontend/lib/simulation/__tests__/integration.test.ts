import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { simulateTransaction } from '../simulate'
import { getPublicClient } from '@/lib/server/rpc'
import { getSolanaConnection } from '@/lib/server/solana'

vi.mock('@/lib/server/rpc', () => ({
  getRpcUrl: vi.fn().mockReturnValue('https://mock-rpc.com'),
  getPublicClient: vi.fn(),
}))

vi.mock('@/lib/server/solana', () => ({
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

  it('extracts allowance changes from approvals field', async () => {
    mockClient.request.mockResolvedValueOnce({
      gasUsed: '21000',
      approvals: [
        {
          owner: '0x1234567890123456789012345678901234567890',
          spender: '0xdef',
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
      to: '0xdef',
      data: '0x',
      value: '0'
    })

    expect(result.stateChanges).toContainEqual({
      asset: 'USDC',
      assetAddress: '0xusdc',
      change: 'Approve 1',
      type: 'allowance',
      decimals: 6,
      chainId: 'ethereum'
    })
  })

  it('returns success: false when alchemy request throws', async () => {
    mockClient.request.mockRejectedValueOnce(new Error('Network timeout'))
    const result = await simulateTransaction({
      chain: 'ethereum',
      from: '0x123',
      to: '0x456',
      data: '0x',
      value: '0'
    })
    expect(result.success).toBe(false)
    expect(result.revertReason).toContain('Network timeout')
  })

  it('returns success: true with empty stateChanges when no assetChanges in response', async () => {
    mockClient.request.mockResolvedValueOnce({ gasUsed: '21000' })
    const result = await simulateTransaction({
      chain: 'ethereum',
      from: '0x123',
      to: '0x456',
      data: '0x',
      value: '0'
    })
    expect(result.success).toBe(true)
    expect(result.stateChanges).toEqual([])
  })

  it('returns success: false for a failed Solana simulation', async () => {
    const mockConn = {
      simulateTransaction: vi.fn().mockResolvedValue({
        value: { err: { InstructionError: [0, 'InvalidArgument'] } }
      })
    }
    vi.mocked(getSolanaConnection).mockReturnValue(mockConn as any)

    const result = await simulateTransaction({
      chain: 'solana',
      from: 'SolAddr',
      to: 'SolAddr',
      data: 'base64tx==',
      value: '0'
    })
    expect(result.success).toBe(false)
    expect(result.revertReason).toBeDefined()
  })

  it('falls back to Tenderly if Alchemy fails and credentials are set', async () => {
    process.env.TENDERLY_ACCESS_KEY = 'test-key'
    process.env.TENDERLY_ACCOUNT_SLUG = 'test-acc'
    process.env.TENDERLY_PROJECT_SLUG = 'test-proj'
    
    mockClient.request.mockRejectedValueOnce(new Error('Alchemy down'))
    
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        transaction: { status: true, gas_used: 50000 }
      })
    }) as any

    const result = await simulateTransaction({
      chain: 'ethereum',
      from: '0x123',
      to: '0x456',
      data: '0x',
      value: '0'
    })
    expect(result.success).toBe(true)
    expect(result.gasEstimate).toBe(50000n)
  })
})
