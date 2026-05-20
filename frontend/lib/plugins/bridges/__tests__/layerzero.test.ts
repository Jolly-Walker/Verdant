import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { layerzeroBridgePlugin } from '../layerzero'
import { BridgeQuoteParams, BridgeQuote } from '@/types/shared'

describe('layerzeroBridgePlugin', () => {
  const mockQuoteParams: BridgeQuoteParams = {
    fromChain: 'ethereum',
    toChain: 'arbitrum',
    token: 'USDC',
    amount: '100000000', // 100 USDC (6 decimals)
    recipientAddress: '0x1234567890123456789012345678901234567890',
    slippagePercent: 0.1,
  }

  it('should return a quote correctly', async () => {
    const quote = await layerzeroBridgePlugin.getQuote(mockQuoteParams)

    expect(quote).not.toBeNull()
    expect(quote?.bridgeId).toBe('layerzero')
    expect(quote?.feeUsd).toBe(1.50)
    // @ts-expect-error - accessing rawQuote
    expect(quote?.rawQuote.destDomain).toBe(3) // Arbitrum
  })

  it('should build a bridge transaction correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'layerzero',
      feeUsd: 1.50,
      estimatedTimeSeconds: 600,
      expectedOutputAmount: '100000000',
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        destDomain: 3,
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '100000000',
        recipientAddress: '0x1234567890123456789012345678901234567890'
      },
    }

    const tx = await layerzeroBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)

    expect(tx.chainId).toBe(1)
    expect(tx.to).toBe('0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d')
    expect(tx.data).toBeDefined()
    expect(tx.value).toBe(0n)
    expect(tx.description).toContain('Bridge USDC')
  })

  it('should return pending status', async () => {
    const status = await layerzeroBridgePlugin.pollStatus('0x123', 'ethereum')
    expect(status.status).toBe('pending')
  })
})
