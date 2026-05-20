import { BridgeQuote } from '@/types/shared'

/**
 * Sorts bridge quotes in descending order of expectedOutputAmount using BigInt
 * to maintain precision for high-value transfers.
 */
export function sortBridgeQuotes(quotes: BridgeQuote[]): BridgeQuote[] {
  return [...quotes].sort((a, b) => {
    const diff = BigInt(b.expectedOutputAmount) - BigInt(a.expectedOutputAmount)
    return diff > 0n ? 1 : diff < 0n ? -1 : 0
  })
}
