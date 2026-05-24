import 'server-only'
import { fetchPoolApys, DefillamaPool } from './defillama'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { CHAIN_REGISTRY } from '@/lib/plugins/chains'
import { DepositDestination } from '@/lib/sequenceBuilder/types'
import { ChainId, ProtocolId } from '@/types/shared'

const MIN_TVL_USD = 1_000_000
const EXCLUDED_CATEGORIES = ['Liquidity Pool', 'LP']
const INCLUDED_EXPOSURE: Array<DefillamaPool['exposure']> = ['single', null]

// DeFi Llama category strings that correspond to lending/supply/staking
const INCLUDED_CATEGORIES = [
  'Lending',
  'CDP',
  'Staking',
  'Yield',
  'Restaking',
]

/**
 * Derives a Verdant ChainId from DeFi Llama's chain name string.
 * Built from the chain registry — no hardcoding.
 */
function buildChainLookup(): Record<string, ChainId> {
  const lookup: Record<string, ChainId> = {}
  for (const plugin of Object.values(CHAIN_REGISTRY)) {
    lookup[plugin.defillamaChain.toLowerCase()] = plugin.id
  }
  return lookup
}

/**
 * Builds a lookup from DeFi Llama project slug → ProtocolId.
 * Derived from the protocol registry — no hardcoding.
 */
function buildProtocolLookup(): Record<string, ProtocolId> {
  const lookup: Record<string, ProtocolId> = {}
  for (const plugin of Object.values(PROTOCOL_REGISTRY)) {
    lookup[plugin.defillamaSlug.toLowerCase()] = plugin.id
  }
  return lookup
}

/**
 * Extracts the primary input token symbol from a DeFi Llama pool symbol.
 *
 * DeFi Llama symbols are varied:
 *   'USDC'               → 'USDC'
 *   'USDC-WETH'          → null (LP, excluded by exposure filter already)
 *   'WETH (Re7 WETH)'    → 'WETH'
 *   'DAI+'               → 'DAI'
 *
 * Returns null if the symbol appears to be multi-asset.
 */
function extractInputToken(symbol: string): string | null {
  if (symbol.includes('-')) return null  // LP pair
  const cleaned = symbol
    .replace(/\(.*?\)/g, '')   // remove parenthetical annotations
    .replace(/[+*]/g, '')      // remove modifier characters
    .trim()
    .toUpperCase()
  if (!cleaned) return null
  return cleaned
}

/**
 * Derives a display name from the pool data.
 * Format: '{ProtocolDisplayName} — {poolMeta or symbol}'
 */
function buildDisplayName(
  pool: DefillamaPool,
  protocolDisplayName: string
): string {
  if (pool.poolMeta) {
    // poolMeta contains vault-specific names like 'Gauntlet USDC Core'
    return `${protocolDisplayName} — ${pool.poolMeta}`
  }
  // Fall back to cleaned symbol
  const token = extractInputToken(pool.symbol) || pool.symbol
  return `${protocolDisplayName} — ${token}`
}

/**
 * Extracts lock period information from a pool.
 *
 * DeFi Llama does not have a structured lock field. We use poolMeta
 * text analysis as the signal: pools with lock/vesting language in
 * poolMeta have a non-null lockDescription. Exact day count is
 * extracted if a number precedes 'day' or 'd' in the meta text.
 */
function extractLockInfo(pool: DefillamaPool): {
  lockPeriodDays: number | null
  lockDescription: string | null
} {
  if (!pool.poolMeta) return { lockPeriodDays: null, lockDescription: null }

  const meta = pool.poolMeta.toLowerCase()
  const lockKeywords = ['lock', 'vest', 'locked', 'vesting', 'unbonding', 'cooldown']
  const hasLock = lockKeywords.some(kw => meta.includes(kw))

  if (!hasLock) return { lockPeriodDays: null, lockDescription: null }

  // Try to extract a day count: "90d", "90 days", "90-day"
  const dayMatch = meta.match(/(\d+)\s*-?\s*d(ay)?s?/)
  const lockPeriodDays = dayMatch ? parseInt(dayMatch[1], 10) : null

  return {
    lockPeriodDays,
    lockDescription: pool.poolMeta,  // show the original text in the UI
  }
}

/**
 * Filters a DeFi Llama pool against Verdant's inclusion criteria.
 */
function isEligible(pool: DefillamaPool): boolean {
  // Must be above TVL floor
  if (pool.tvlUsd < MIN_TVL_USD) return false

  // Must be audited
  if (!pool.audits) return false

  // Must be single-asset exposure (excludes LPs)
  if (!INCLUDED_EXPOSURE.includes(pool.exposure)) return false

  // Must not be an LP category even if exposure was null
  if (pool.category && EXCLUDED_CATEGORIES.some(c =>
    pool.category!.toLowerCase().includes(c.toLowerCase())
  )) return false

  // Must be a lending/supply/staking category (or null — include uncategorised)
  if (pool.category && !INCLUDED_CATEGORIES.some(c =>
    pool.category!.toLowerCase().includes(c.toLowerCase())
  )) return false

  // Must have a parseable single-asset symbol
  if (extractInputToken(pool.symbol) === null) return false



  return true
}

/**
 * Fetches all deposit destinations across all registered protocols and chains.
 * Cached at the DeFi Llama fetch layer (15 min).
 *
 * @param filterToken  Optional — filter to a specific token symbol (e.g. 'USDC')
 * @param filterChain  Optional — filter to a specific chain
 */
export async function fetchDepositDestinations(
  filterToken?: string,
  filterChain?: ChainId
): Promise<DepositDestination[]> {
  const pools = await fetchPoolApys()
  const chainLookup = buildChainLookup()
  const protocolLookup = buildProtocolLookup()

  const destinations: DepositDestination[] = []

  for (const pool of pools) {
    if (!isEligible(pool)) continue

    // Match chain
    const chainId = chainLookup[pool.chain.toLowerCase()]
    if (!chainId) continue  // chain not supported by Verdant
    if (filterChain && chainId !== filterChain) continue

    // Match protocol
    const protocolId = protocolLookup[pool.project.toLowerCase()]
    if (!protocolId) continue  // protocol not registered
    const protocolPlugin = PROTOCOL_REGISTRY[protocolId]

    // Ensure the protocol supports supply/deposit operations
    if (!protocolPlugin.supportedPositionTypes.includes('supply')) continue

    // Match token
    const token = extractInputToken(pool.symbol)
    if (!token) continue
    if (filterToken && token !== filterToken.toUpperCase()) continue

    const { lockPeriodDays, lockDescription } = extractLockInfo(pool)

    // Derive receipt token outputTokenSymbol
    let outputTokenSymbol = pool.symbol
    if (protocolId === 'aave') {
      outputTokenSymbol = `a${token}`
    } else if (protocolId === 'euler') {
      outputTokenSymbol = `e${token}`
    }

    destinations.push({
      id: pool.pool,              // DeFi Llama UUID — stable
      protocol: protocolId,
      chain: chainId,
      token,
      apy: pool.apy / 100,       // DeFi Llama returns percentage, convert to decimal
      apyMean30d: pool.apyMean30d != null ? pool.apyMean30d / 100 : null,
      apyBase: pool.apyBase != null ? pool.apyBase / 100 : null,
      apyReward: pool.apyReward != null ? pool.apyReward / 100 : null,
      displayName: buildDisplayName(pool, protocolPlugin.displayName),
      outputTokenSymbol,
      apyType: 'variable',
      tvlUsd: pool.tvlUsd,
      rewardTokens: pool.rewardTokens ?? [],
      lockPeriodDays,
      lockDescription,
    })
  }

  // Sort: highest current APY first
  return destinations.sort((a, b) => b.apy - a.apy)
}
