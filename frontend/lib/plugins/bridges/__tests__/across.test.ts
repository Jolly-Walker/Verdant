import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { acrossBridgePlugin } from '../across'
import { BridgeQuoteParams, BridgeQuote } from '@/types/shared'
import { fetchTokenPrices } from '@/lib/data/prices'

vi.mock('@/lib/data/prices', () => ({
  fetchTokenPrices: vi.fn(),
}))

describe('acrossBridgePlugin', () => {
  const mockQuoteParams: BridgeQuoteParams = {
    fromChain: 'ethereum',
    toChain: 'arbitrum',
    token: 'USDC',
    amount: '100000000', // 100 USDC (6 decimals)
    recipientAddress: '0x1234567890123456789012345678901234567890',
    slippagePercent: 0.1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('should return a quote correctly', async () => {
    const mockApiResponse = {
      relayFeeTotal: '100000',
      relayGasFeeTotal: '50000',
      capitalFeeTotal: '10000',
      estimatedFillTime: 120,
      timestamp: 1700000000,
    }

    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    })

    // @ts-expect-error - mocking fetchTokenPrices
    ;(fetchTokenPrices as vi.Mock).mockResolvedValueOnce({
      'coingecko:usd-coin': 1.0,
    })

    const quote = await acrossBridgePlugin.getQuote(mockQuoteParams)

    expect(quote).not.toBeNull()
    expect(quote?.bridgeId).toBe('across')
    expect(quote?.expectedOutputAmount).toBe('99840000') // 100000000 - (100000 + 50000 + 10000)
    expect(quote?.feeUsd).toBeCloseTo(0.16, 2) // (160000 / 1e6) * 1.0
  })

  it('should build a bridge transaction correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'across',
      feeUsd: 0.16,
      estimatedTimeSeconds: 120,
      expectedOutputAmount: '99840000',
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        inputAmount: '100000000',
        inputToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        outputToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        originChainId: 1,
        destinationChainId: 42161,
        recipientAddress: '0x1234567890123456789012345678901234567890',
        timestamp: 1700000000,
        tokenSymbol: 'USDC',
        decimals: 6
      },
    }

    const tx = await acrossBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0x59728544B08AB483533076417FbBB2fD0B17CE3a')
    expect(tx.data).toBeDefined()
    expect(tx.data.startsWith('0x')).toBe(true)
    expect(tx.value).toBe(0n)
  })
  
  it('should build a native ETH bridge transaction correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'across',
      feeUsd: 5.0,
      estimatedTimeSeconds: 120,
      expectedOutputAmount: '990000000000000000',
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        inputAmount: '1000000000000000000',
        inputToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        outputToken: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        originChainId: 1,
        destinationChainId: 42161,
        recipientAddress: '0x1234567890123456789012345678901234567890',
        timestamp: 1700000000,
        tokenSymbol: 'ETH',
        decimals: 18
      },
    }

    const tx = await acrossBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.value).toBe(1000000000000000000n)
  })

  it('should poll status correctly', async () => {
    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'filled', fillTxs: [{ hash: '0xabc' }] }),
    })

    const status = await acrossBridgePlugin.pollStatus('0x123', 'ethereum')

    expect(status.status).toBe('complete')
    expect(status.destinationTxHash).toBe('0xabc')
  })
})
