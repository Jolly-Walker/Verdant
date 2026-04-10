/**
 * Defillama Yields API client.
 * Docs: https://defillama.com/docs/api
 */

const YIELDS_API = 'https://yields.llama.fi/pools'

export interface DefillamaPool {
  pool: string
  project: string
  chain: string
  symbol: string
  apy: number
  apyBase: number | null
  apyReward: number | null
  tvlUsd: number
  totalSupplyUsd: number | null
  totalBorrowUsd: number | null
  stablecoin: boolean
}

let poolCache: { data: DefillamaPool[]; fetchedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

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
    pool: p.pool as string,
    project: p.project as string,
    chain: p.chain as string,
    symbol: p.symbol as string,
    apy: (p.apy as number) || 0,
    apyBase: (p.apyBase as number) ?? null,
    apyReward: (p.apyReward as number) ?? null,
    tvlUsd: (p.tvlUsd as number) || 0,
    totalSupplyUsd: (p.totalSupplyUsd as number) ?? null,
    totalBorrowUsd: (p.totalBorrowUsd as number) ?? null,
    stablecoin: (p.stablecoin as boolean) || false,
  }))

  poolCache = { data: pools, fetchedAt: Date.now() }
  return pools
}

/** Defillama chain name mapping */
const CHAIN_MAP: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
}

/** Defillama project slug mapping */
const PROJECT_MAP: Record<string, string> = {
  aave: 'aave-v3',
  morpho: 'morpho-blue',
  pendle: 'pendle',
  euler: 'euler',
}

/**
 * Find the best matching pool for a given protocol/chain/asset combo.
 * Returns APY (decimal), TVL, and utilisation ratio for the highest-TVL match.
 */
export async function findPoolApy(
  protocol: string,
  chain: string,
  asset: string
): Promise<{ apy: number; tvlUsd: number; utilisationDecimal: number | null } | null> {
  const pools = await fetchPoolApys()
  const projectSlug = PROJECT_MAP[protocol] || protocol
  const chainName = CHAIN_MAP[chain] || chain

  const assetUpper = asset.toUpperCase()

  const matches = pools.filter((p) => {
    const matchProject = p.project.toLowerCase() === projectSlug.toLowerCase()
    const matchChain = p.chain.toLowerCase() === chainName.toLowerCase()
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
