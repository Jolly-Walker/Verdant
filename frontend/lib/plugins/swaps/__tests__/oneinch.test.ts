import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { oneinchPlugin } from '../oneinch'
import { SwapQuote, SwapQuoteParams } from '../../types/swap-plugin'

const baseParams: SwapQuoteParams = {
  fromChain: 'ethereum',
  fromToken: 'USDC',
  toToken: 'WETH',
  amount: '1000', // 1000 USDC
  userAddress: '0x1234567890123456789012345678901234567890',
  slippagePercent: 1,
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as unknown as Response
}

describe('oneinchPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    process.env.ONEINCH_API_KEY = 'test-key'
  })
  afterEach(() => {
    delete process.env.ONEINCH_API_KEY
  })

  it('returns null when no API key is configured', async () => {
    delete process.env.ONEINCH_API_KEY
    const quote = await oneinchPlugin.getQuote(baseParams)
    expect(quote).toBeNull()
  })

  it('returns null for an unsupported chain', async () => {
    const quote = await oneinchPlugin.getQuote({ ...baseParams, fromChain: 'solana' })
    expect(quote).toBeNull()
  })

  it('fetches a quote and converts the output to human units', async () => {
    // 0.3 WETH out (18 decimals)
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ dstAmount: '300000000000000000' })
    )

    const quote = await oneinchPlugin.getQuote(baseParams)
    expect(quote).not.toBeNull()
    expect(quote?.aggregator).toBe('1inch')
    expect(quote?.toAmount).toBe('0.3')

    // Sent the amount in USDC's 6 decimals
    const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('amount=1000000000')
    expect(calledUrl).toContain('/1/quote')
  })

  it('sends Bearer auth header', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ dstAmount: '1' }))
    await oneinchPlugin.getQuote(baseParams)
    const opts = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('builds a swap transaction', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ tx: { to: '0xRouter', data: '0xabcdef', value: '0' } })
    )

    const quote: SwapQuote = {
      aggregator: '1inch',
      fromToken: 'USDC',
      toToken: 'WETH',
      fromAmount: '1000',
      toAmount: '0.3',
      feeUsd: 0,
      priceImpactPercent: 0,
      expiresAt: new Date(),
      rawQuote: {
        chainId: 1,
        src: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        dst: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amountWei: '1000000000',
        dstDecimals: 18,
        slippagePercent: 1,
      },
    }

    const tx = await oneinchPlugin.buildSwapTx(quote, baseParams.userAddress)
    expect(tx.to).toBe('0xRouter')
    expect(tx.data).toBe('0xabcdef')
    expect(tx.chainId).toBe(1)
    expect(tx.description).toContain('1inch')
  })

  it('throws on swap build when API key is missing', async () => {
    delete process.env.ONEINCH_API_KEY
    const quote = { rawQuote: { chainId: 1, src: '0x', dst: '0x', amountWei: '1', dstDecimals: 18, slippagePercent: 1 } } as unknown as SwapQuote
    await expect(oneinchPlugin.buildSwapTx(quote, baseParams.userAddress)).rejects.toThrow(/ONEINCH_API_KEY/)
  })
})
