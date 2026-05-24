/**
 * Defillama Yields API client.
 * Docs: https://defillama.com/docs/api
 */

const YIELDS_API = 'https://yields.llama.fi/pools'

export interface DefillamaPool {
  pool: string               // pool UUID — use as stable ID
  project: string            // e.g. 'aave-v3'
  chain: string              // DeFi Llama chain name e.g. 'Ethereum'
  symbol: string             // e.g. 'USDC', 'WETH-USDC' for LPs
  apy: number                // current APY, percentage (not decimal)
  apyBase: number | null     // base APY (lending rate), percentage
  apyReward: number | null   // reward APY on top, percentage
  apyMean30d: number | null  // 30-day mean APY, percentage
  tvlUsd: number
  totalSupplyUsd: number | null
  totalBorrowUsd: number | null
  stablecoin: boolean
  // Filtering fields
  audits: string | null      // null = not audited; any string = audited
  exposure: 'single' | 'multi' | null  // 'multi' = LP, exclude
  poolMeta: string | null    // free text, may contain lock/vesting info
  underlyingTokens: string[] | null    // token contract addresses
  rewardTokens: string[] | null        // reward token addresses
  ilRisk: 'yes' | 'no' | null          // IL risk flag (LPs)
  category: string | null    // 'Lending', 'Staking', 'CDP', etc.
}

let poolCache: { data: DefillamaPool[]; fetchedAt: number } | null = null
const CACHE_TTL_MS = 15 * 60 * 1000  // 15 minutes

/**
 * Fetch all pools from Defillama Yields API (with in-memory caching and timeout).
 */
export async function fetchPoolApys(): Promise<DefillamaPool[]> {
  if (poolCache && Date.now() - poolCache.fetchedAt < CACHE_TTL_MS) {
    return poolCache.data
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  let res: Response
  try {
    res = await fetch(YIELDS_API, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    throw new Error(`Defillama API error: ${res.status}`)
  }

  const json = await res.json()
  const pools: DefillamaPool[] = (json.data || []).map((p: Record<string, unknown>) => ({
    pool:             p.pool as string,
    project:          p.project as string,
    chain:            p.chain as string,
    symbol:           p.symbol as string,
    apy:              (p.apy as number) || 0,
    apyBase:          (p.apyBase as number) ?? null,
    apyReward:        (p.apyReward as number) ?? null,
    apyMean30d:       (p.apyMean30d as number) ?? null,
    tvlUsd:           (p.tvlUsd as number) || 0,
    totalSupplyUsd:   (p.totalSupplyUsd as number) ?? null,
    totalBorrowUsd:   (p.totalBorrowUsd as number) ?? null,
    stablecoin:       (p.stablecoin as boolean) || false,
    audits:           (p.audits as string | null) ?? null,
    exposure:         (p.exposure as 'single' | 'multi') ?? null,
    poolMeta:         (p.poolMeta as string) ?? null,
    underlyingTokens: (p.underlyingTokens as string[]) ?? null,
    rewardTokens:     (p.rewardTokens as string[]) ?? null,
    ilRisk:           (p.ilRisk as 'yes' | 'no') ?? null,
    category:         (p.category as string) ?? null,
  }))

  poolCache = { data: pools, fetchedAt: Date.now() }
  return pools
}

/**
 * Find the best matching pool for a given protocol/chain/asset combo.
 * Returns APY (decimal), TVL, and utilisation ratio for the highest-TVL match.
 */
export async function findPoolApy(
  defillamaSlug: string,    // was: protocol string looked up in PROJECT_MAP
  defillamaChain: string,   // was: chain string looked up in CHAIN_MAP
  asset: string
): Promise<{ apy: number; tvlUsd: number; utilisationDecimal: number | null } | null> {
  const pools = await fetchPoolApys()
  const assetUpper = asset.toUpperCase()

  const matches = pools.filter((p) => {
    const matchProject = p.project.toLowerCase() === defillamaSlug.toLowerCase()
    const matchChain = p.chain.toLowerCase() === defillamaChain.toLowerCase()
    const matchSymbol = p.symbol.toUpperCase().includes(assetUpper)
    return matchProject && matchChain && matchSymbol
  })

  if (matches.length === 0) {
    return null
  }

  // Return the highest-TVL match
  const best = matches.reduce((a, b) => (a.tvlUsd > b.tvlUsd ? a : b))

  // Compute utilisation = borrows / supply (lending pools only)
  let utilisationDecimal: number | null = null
  if (best.totalSupplyUsd && best.totalSupplyUsd > 0 && best.totalBorrowUsd !== null) {
    utilisationDecimal = best.totalBorrowUsd / best.totalSupplyUsd
  }

  return {
    apy: best.apy / 100, // Convert percentage to decimal
    tvlUsd: best.tvlUsd,
    utilisationDecimal,
  }
}
