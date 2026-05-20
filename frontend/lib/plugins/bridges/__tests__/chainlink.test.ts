import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { chainlinkBridgePlugin } from '../chainlink'
import { BridgeQuoteParams, BridgeQuote } from '@/types/shared'

describe('chainlinkBridgePlugin', () => {
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
    expect(quote?.feeUsd).toBe(2.50)
    // @ts-expect-error - accessing rawQuote
    expect(quote?.rawQuote.destSelector).toBe(4949039107694359620n)

    const now = Date.now()
    expect(quote?.expiresAt.getTime()).toBeGreaterThanOrEqual(now + 89000)
    expect(quote?.expiresAt.getTime()).toBeLessThanOrEqual(now + 91000)
  })

  it('should build a bridge transaction for ERC20 correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'chainlink',
      feeUsd: 2.50,
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
        recipientAddress: '0x1234567890123456789012345678901234567890'
      },
    }

    const tx = await chainlinkBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0x80226fc079A2dea56C78548F56E2e88ba1146f7d')
    expect(tx.data).toBeDefined()
    expect(tx.value).toBe(0n)
    expect(tx.description).toContain('Bridge USDC')
  })

  it('should build a bridge transaction for ETH correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'chainlink',
      feeUsd: 2.50,
      estimatedTimeSeconds: 900,
      expectedOutputAmount: '1000000000000000000',
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        destSelector: 4949039107694359620n,
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        token: 'ETH',
        amount: '1000000000000000000',
        recipientAddress: '0x1234567890123456789012345678901234567890'
      },
    }

    const tx = await chainlinkBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.value).toBe(1000000000000000000n)
    expect(tx.description).toContain('Bridge ETH')
  })
})
