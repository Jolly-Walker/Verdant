import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { nearIntentsBridgePlugin } from '../nearIntents'
import { BridgeQuoteParams, BridgeQuote } from '@/types/shared'
import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges'

describe('nearIntentsBridgePlugin', () => {
  const mockNow = 1700000000000
  const mockQuoteParams: BridgeQuoteParams = {
    fromChain: 'ethereum',
    toChain: 'solana',
    token: 'USDC',
    amount: '100000000', // 100 USDC (6 decimals)
    recipientAddress: 'user.sol',
    slippagePercent: 0.5,
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
      jsonrpc: '2.0',
      id: 1,
      result: '0x1234567890123456789012345678901234567890',
    }

    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    })

    const quote = await nearIntentsBridgePlugin.getQuote(mockQuoteParams)

    expect(quote).not.toBeNull()
    expect(quote?.bridgeId).toBe('nearIntents')
    expect(quote?.expectedOutputAmount).toBe('100000000')
    expect(quote?.feeUsd).toBe(2.0)
    // @ts-expect-error - accessing rawQuote
    expect(quote?.rawQuote.depositAddress).toBe('0x1234567890123456789012345678901234567890')
    
    expect(quote?.expiresAt.getTime()).toBe(mockNow + BRIDGE_QUOTE_TTL_MS)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://bridge.chaindefuser.com/rpc',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('deposit_address')
      })
    )
  })

  it('should map chains correctly', async () => {
    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', result: '0x1234567890123456789012345678901234567890' }),
    })

    await nearIntentsBridgePlugin.getQuote({ ...mockQuoteParams, fromChain: 'arbitrum' })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('eth:42161')
      })
    )

    await nearIntentsBridgePlugin.getQuote({ ...mockQuoteParams, fromChain: 'base' })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('eth:8453')
      })
    )
  })

  it('should build an ERC20 bridge transaction correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'nearIntents',
      feeUsd: 2.0,
      estimatedTimeSeconds: 60,
      expectedOutputAmount: '100000000',
      slippagePercent: 0.5,
      expiresAt: new Date(),
      rawQuote: {
        depositAddress: '0x1234567890123456789012345678901234567890',
        fromChain: 'ethereum',
        token: 'USDC',
        amount: '100000000',
        recipientAddress: 'user.sol'
      },
    }

    const tx = await nearIntentsBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48') // USDC Mainnet
    expect(tx.data).toBeDefined()
    expect(tx.value).toBe(0n)
    expect(tx.description).toContain('Bridge USDC')
  })

  it('should build a native ETH bridge transaction correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'nearIntents',
      feeUsd: 2.0,
      estimatedTimeSeconds: 60,
      expectedOutputAmount: '1000000000000000000',
      slippagePercent: 0.5,
      expiresAt: new Date(),
      rawQuote: {
        depositAddress: '0x1234567890123456789012345678901234567890',
        fromChain: 'ethereum',
        token: 'ETH',
        amount: '1000000000000000000',
        recipientAddress: 'user.sol'
      },
    }

    const tx = await nearIntentsBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0x1234567890123456789012345678901234567890')
    expect(tx.value).toBe(1000000000000000000n)
    expect(tx.description).toContain('Bridge ETH')
  })

  it('should return pending status with tracking URL', async () => {
    const status = await nearIntentsBridgePlugin.pollStatus('0x123', 'ethereum')
    expect(status.status).toBe('pending')
    expect(status.trackingUrl).toBe('https://bridge.chaindefuser.com')
  })

  it('should return null for unsupported toChain', async () => {
    const quote = await nearIntentsBridgePlugin.getQuote({
      ...mockQuoteParams,
      toChain: 'arbitrum'
    })
    expect(quote).toBeNull()
  })

  it('should return null for unsupported token', async () => {
    // Mock fetch to return a result, to ensure it returns null due to validation
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', result: '0x123' }),
    })

    const quote = await nearIntentsBridgePlugin.getQuote({
      ...mockQuoteParams,
      token: 'LINK'
    })
    expect(quote).toBeNull()
  })

  it('should return null when RPC returns error', async () => {
    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', error: { message: 'invalid account' } }),
    })

    const quote = await nearIntentsBridgePlugin.getQuote(mockQuoteParams)
    expect(quote).toBeNull()
  })

  it('should return null when API returns non-OK response', async () => {
    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: false,
    })

    const quote = await nearIntentsBridgePlugin.getQuote(mockQuoteParams)
    expect(quote).toBeNull()
  })

  it('should return null when API throws', async () => {
    // @ts-expect-error - mocking fetch
    ;(global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'))

    const quote = await nearIntentsBridgePlugin.getQuote(mockQuoteParams)
    expect(quote).toBeNull()
  })

  it('should return null if getQuote times out', async () => {
    // Mock fetch to hang and handle abort signal
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((_url: unknown, options: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new Error('The user aborted a request.'))
          })
        }
      })
    })

    const quotePromise = nearIntentsBridgePlugin.getQuote(mockQuoteParams)
    
    // Advance timers by 8001ms to trigger timeout
    await vi.advanceTimersByTimeAsync(8001)
    
    const quote = await quotePromise
    expect(quote).toBeNull()
  }, 15000)
})
