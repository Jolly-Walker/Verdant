import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { chainlinkBridgePlugin } from '../chainlink'
import { BridgeQuoteParams, BridgeQuote } from '@/types/shared'
import { getPublicClient } from '@/lib/server/rpc'

vi.mock('@/lib/server/rpc', () => ({
  getPublicClient: vi.fn(),
}))

describe('chainlinkBridgePlugin', () => {
  const mockPublicClient = {
    readContract: vi.fn(),
  }

  beforeEach(() => {
    vi.mocked(getPublicClient).mockReturnValue(mockPublicClient as any)
    mockPublicClient.readContract.mockResolvedValue(1000000000000000n) // 0.001 ETH fee
  })

  const mockQuoteParams: BridgeQuoteParams = {
    fromChain: 'ethereum',
    toChain: 'arbitrum',
    token: 'USDC',
    amount: '100000000',
    recipientAddress: '0x1234567890123456789012345678901234567890',
    slippagePercent: 0.1,
  }

  it('should return a quote correctly', async () => {
    const quote = await chainlinkBridgePlugin.getQuote(mockQuoteParams)

    expect(quote).not.toBeNull()
    expect(quote?.bridgeId).toBe('chainlink')
    expect(quote?.feeUsd).toBe(2.5)
    // @ts-expect-error - accessing rawQuote
    expect(quote?.rawQuote.destSelector).toBe(4949039107694359620n)

    const now = Date.now()
    expect(quote?.expiresAt.getTime()).toBeGreaterThanOrEqual(now + 89000)
    expect(quote?.expiresAt.getTime()).toBeLessThanOrEqual(now + 91000)
  })

  it('should return a quote for LINK correctly', async () => {
    const linkQuoteParams: BridgeQuoteParams = {
      ...mockQuoteParams,
      token: 'LINK',
      amount: '1000000000000000000', // 1 LINK
    }
    const quote = await chainlinkBridgePlugin.getQuote(linkQuoteParams)

    expect(quote).not.toBeNull()
    expect(quote?.bridgeId).toBe('chainlink')
    expect(quote?.feeUsd).toBe(2.5)
    // @ts-expect-error - accessing rawQuote
    expect(quote?.rawQuote.token).toBe('LINK')
    // @ts-expect-error - accessing rawQuote
    expect(quote?.rawQuote.amount).toBe('1000000000000000000')
  })

  it('should build a bridge transaction for ERC20 correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'chainlink',
      feeUsd: 2.5,
      estimatedTimeSeconds: 900,
      expectedOutputAmount: '100000000',
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        destSelector: 4949039107694359620n,
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        token: 'USDC',
        amount: '100000000',
        recipientAddress: '0x1234567890123456789012345678901234567890',
      },
    }

    const tx = await chainlinkBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0x80226fc079A2dea56C78548F56E2e88ba1146f7d')
    expect(tx.data).toBeDefined()
    expect(tx.value).toBe(1000000000000000n) // Just the fee
    expect(tx.description).toContain('Bridge USDC')
    expect(mockPublicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'getFee',
      })
    )
  })

  it('should build a bridge transaction for ETH correctly', async () => {
    const amount = 1000000000000000000n
    const fee = 1000000000000000n
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'chainlink',
      feeUsd: 2.5,
      estimatedTimeSeconds: 900,
      expectedOutputAmount: amount.toString(),
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        destSelector: 4949039107694359620n,
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        token: 'ETH',
        amount: amount.toString(),
        recipientAddress: '0x1234567890123456789012345678901234567890',
      },
    }

    const tx = await chainlinkBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.value).toBe(amount + fee) // Amount + fee
    expect(tx.description).toContain('Bridge ETH')
  })

  it('should build a bridge transaction for LINK correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'chainlink',
      feeUsd: 2.5,
      estimatedTimeSeconds: 900,
      expectedOutputAmount: '1000000000000000000',
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        destSelector: 4949039107694359620n,
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        token: 'LINK',
        amount: '1000000000000000000',
        recipientAddress: '0x1234567890123456789012345678901234567890',
      },
    }

    const tx = await chainlinkBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0x80226fc079A2dea56C78548F56E2e88ba1146f7d')
    expect(tx.data).toBeDefined()
    expect(tx.value).toBe(1000000000000000n) // Just the fee
    expect(tx.description).toContain('Bridge LINK')
  })

  it('should return pending status with tracking URL', async () => {
    const status = await chainlinkBridgePlugin.pollStatus('0x123', 'ethereum')
    expect(status.status).toBe('pending')
    expect(status.trackingUrl).toBe('https://ccip.chain.link/tx/0x123')
  })
})
