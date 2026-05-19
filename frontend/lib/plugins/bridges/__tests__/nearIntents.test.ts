import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { nearIntentsBridgePlugin } from '../nearIntents'
import { BridgeQuoteParams } from '@/types/shared'

describe('nearIntentsBridgePlugin', () => {
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
    global.fetch = vi.fn()
  })

  it('should return a quote correctly', async () => {
    const mockApiResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: '0xDEPOSIT_ADDRESS',
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    })

    const quote = await nearIntentsBridgePlugin.getQuote(mockQuoteParams)

    expect(quote).not.toBeNull()
    expect(quote?.bridgeId).toBe('nearIntents')
    expect(quote?.expectedOutputAmount).toBe('100000000')
    expect(quote?.feeUsd).toBe(2.0)
    expect((quote?.rawQuote as any).depositAddress).toBe('0xDEPOSIT_ADDRESS')
    
    expect(global.fetch).toHaveBeenCalledWith(
      'https://bridge.chaindefuser.com/rpc',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('deposit_address')
      })
    )
  })

  it('should map chains correctly', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', result: '0xADDR' }),
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
    const mockQuote = {
      bridgeId: 'nearIntents' as const,
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

    const tx = await nearIntentsBridgePlugin.buildBridgeTx(mockQuote as any)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48') // USDC Mainnet
    expect(tx.data).toBeDefined()
    expect(tx.value).toBe(0n)
    expect(tx.description).toContain('Bridge USDC')
  })

  it('should build a native ETH bridge transaction correctly', async () => {
    const mockQuote = {
      bridgeId: 'nearIntents' as const,
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

    const tx = await nearIntentsBridgePlugin.buildBridgeTx(mockQuote as any)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0x1234567890123456789012345678901234567890')
    expect(tx.value).toBe(1000000000000000000n)
    expect(tx.description).toContain('Bridge ETH')
  })

  it('should return pending status', async () => {
    const status = await nearIntentsBridgePlugin.pollStatus('0x123', 'ethereum')
    expect(status.status).toBe('pending')
  })
})
