import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { acrossBridgePlugin } from '../across'
import { BridgeQuoteParams, BridgeQuote } from '@/types/shared'
import { fetchTokenPrices } from '@/lib/data/prices'
import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges'

vi.mock('@/lib/data/prices', () => ({
  fetchTokenPrices: vi.fn(),
}))

describe('acrossBridgePlugin', () => {
  const mockNow = 1700000000000
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
    vi.useFakeTimers()
    vi.setSystemTime(mockNow)
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
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

    expect(quote?.expiresAt.getTime()).toBe(mockNow + BRIDGE_QUOTE_TTL_MS)
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
      json: async () => ({ 
        status: 'filled', 
        fillTxs: [{ hash: '0xabc' }],
        destinationChainId: 42161 // Arbitrum
      }),
    })

    const status = await acrossBridgePlugin.pollStatus('0x123', 'ethereum')

    expect(status.status).toBe('complete')
    expect(status.destinationTxHash).toBe('0xabc')
    expect(status.trackingUrl).toBe('https://arbiscan.io/tx/0xabc')
  })

  it('should return pending status if not filled', async () => {
    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'pending' }),
    })

    const status = await acrossBridgePlugin.pollStatus('0x123', 'ethereum')

    expect(status.status).toBe('pending')
    expect(status.trackingUrl).toBe('https://across.to/explorer/transactions/0x123')
  })

  it('should return failed status if expired', async () => {
    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'expired' }),
    })

    const status = await acrossBridgePlugin.pollStatus('0x123', 'ethereum')

    expect(status.status).toBe('failed')
    expect(status.errorMessage).toBe('Across deposit expired')
    expect(status.trackingUrl).toBe('https://across.to/explorer/transactions/0x123')
  })

  it('should return null if getQuote times out', async () => {
    // Mock fetch to hang and handle abort signal
    ;(global.fetch as vi.Mock).mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new Error('The user aborted a request.'))
          })
        }
      })
    })

    const quotePromise = acrossBridgePlugin.getQuote(mockQuoteParams)
    
    // Advance timers by 8001ms to trigger timeout
    await vi.advanceTimersByTimeAsync(8001)
    
    const quote = await quotePromise
    expect(quote).toBeNull()
  }, 15000)

  it('should return pending if pollStatus times out', async () => {
    // Mock fetch to hang and handle abort signal
    ;(global.fetch as vi.Mock).mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new Error('The user aborted a request.'))
          })
        }
      })
    })

    const statusPromise = acrossBridgePlugin.pollStatus('0x123', 'ethereum')

    // Advance timers by 8001ms to trigger timeout
    await vi.advanceTimersByTimeAsync(8001)

    const status = await statusPromise
    expect(status.status).toBe('pending')
  }, 15000)
})
