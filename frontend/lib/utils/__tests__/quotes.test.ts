import { describe, it, expect } from 'vitest'
import { sortBridgeQuotes } from '../quotes'
import { BridgeQuote } from '@/types/shared'

describe('sortBridgeQuotes', () => {
  it('should correctly sort quotes with amounts exceeding MAX_SAFE_INTEGER', () => {
    const mockQuotes: Partial<BridgeQuote>[] = [
      { bridgeId: 'across', expectedOutputAmount: '10000000000000000001' }, // 10 ETH + 1 wei
      { bridgeId: 'layerzero', expectedOutputAmount: '10000000000000000005' }, // 10 ETH + 5 wei
      { bridgeId: 'chainlink', expectedOutputAmount: '5000000000000000000' }, // 5 ETH
    ]

    const sorted = sortBridgeQuotes(mockQuotes as BridgeQuote[])

    expect(sorted[0].bridgeId).toBe('layerzero')
    expect(sorted[1].bridgeId).toBe('across')
    expect(sorted[2].bridgeId).toBe('chainlink')
  })

  it('should handle equal amounts correctly', () => {
    const mockQuotes: Partial<BridgeQuote>[] = [
      { bridgeId: 'across', expectedOutputAmount: '1000' },
      { bridgeId: 'layerzero', expectedOutputAmount: '1000' },
    ]

    const sorted = sortBridgeQuotes(mockQuotes as BridgeQuote[])
    expect(sorted.length).toBe(2)
    expect(sorted[0].expectedOutputAmount).toBe('1000')
    expect(sorted[1].expectedOutputAmount).toBe('1000')
  })
})
