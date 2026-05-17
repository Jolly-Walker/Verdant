/**
 * Token price fetching via Defillama Coins API.
 * Docs: https://defillama.com/docs/api
 */
import { CHAIN_DISPLAY_MAP } from '@/lib/plugins/chains/metadata'
import { ChainId } from '@/types/shared'

const COINS_API = 'https://coins.llama.fi/prices/current'

/**
 * Fetch current USD prices for a list of token identifiers.
 * Token IDs should be in coingecko format (e.g., "coingecko:ethereum").
 *
 * @example fetchTokenPrices(["coingecko:ethereum", "coingecko:usd-coin"])
 */
export async function fetchTokenPrices(
  tokenIds: string[]
): Promise<Record<string, number>> {
  if (tokenIds.length === 0) return {}

  const joined = tokenIds.join(',')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  let res: Response
  try {
    res = await fetch(`${COINS_API}/${encodeURIComponent(joined)}`, {
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    throw new Error(`Price API error: ${res.status}`)
  }

  const json = await res.json()
  const coins = json.coins || {}

  const prices: Record<string, number> = {}
  for (const [key, val] of Object.entries(coins)) {
    const v = val as { price?: number }
    if (v.price !== undefined) {
      prices[key] = v.price
    }
  }

  return prices
}

const priceCache: Record<string, { price: number; fetchedAt: number }> = {}
const CACHE_TTL_MS = 60 * 1000 // 1 minute

/**
 * Get the current ETH price in USD. Cached for 1 minute.
 */
export async function getEthPrice(): Promise<number> {
  return getNativeAssetPrice('ethereum')
}

/**
 * Get the current price of the native asset for a given chain.
 */
export async function getNativeAssetPrice(chain: string): Promise<number> {
  const metadata = CHAIN_DISPLAY_MAP[chain as ChainId]
  if (!metadata) {
    throw new Error(`Unsupported chain: ${chain}`)
  }

  const coingeckoId = `coingecko:${metadata.coingeckoId}`
  
  if (priceCache[coingeckoId] && Date.now() - priceCache[coingeckoId].fetchedAt < CACHE_TTL_MS) {
    return priceCache[coingeckoId].price
  }

  const prices = await fetchTokenPrices([coingeckoId])
  const price = prices[coingeckoId]
  
  if (price === undefined) {
    throw new Error(`Failed to fetch price for ${coingeckoId}`)
  }

  priceCache[coingeckoId] = { price, fetchedAt: Date.now() }
  return price
}
