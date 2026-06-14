# Verdant — Live Deposit Destinations via DeFi Llama

Branch: `demo`

This ticket replaces the static `DEPOSIT_DESTINATIONS` array in
`lib/sequenceBuilder/destinations.ts` with live data from the DeFi Llama
Yields API, extended with filtering, 30d APY, reward tokens, and lock period
display. The existing `DepositCard` component is updated to fetch from a new
`/api/destinations` route rather than calling `getDepositDestinations()`
synchronously.

Architecture rule: adding a new protocol to Verdant should require touching
only one file — the protocol plugin. All DeFi Llama mapping, filtering, and
display information derives from what is already declared on the plugin.

---

## Step 1 — Extend `DefillamaPool` type and fetcher

**File:** `frontend/lib/data/defillama.ts`

### 1a — Extend the `DefillamaPool` interface

Replace the current interface with the full field set needed for filtering and
display:

```ts
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
```

### 1b — Update `fetchPoolApys` to map all new fields

In the `.map()` call inside `fetchPoolApys`, add the new fields:

```ts
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
  audits:           (p.audits as string) ?? null,
  exposure:         (p.exposure as 'single' | 'multi') ?? null,
  poolMeta:         (p.poolMeta as string) ?? null,
  underlyingTokens: (p.underlyingTokens as string[]) ?? null,
  rewardTokens:     (p.rewardTokens as string[]) ?? null,
  ilRisk:           (p.ilRisk as 'yes' | 'no') ?? null,
  category:         (p.category as string) ?? null,
}))
```

### 1c — Extend cache TTL to 15 minutes

```ts
const CACHE_TTL_MS = 15 * 60 * 1000  // 15 minutes
```

### 1d — Remove the hardcoded `PROJECT_MAP` and `CHAIN_MAP`

Delete both constants from `defillama.ts`. They are replaced by the protocol
plugin's `defillamaSlug` field (already present on all four plugins) and a
new chain map on the chain plugin (Step 2). The `findPoolApy` function still
needs these mappings — update it to accept them as parameters:

```ts
export async function findPoolApy(
  defillamaSlug: string,    // was: protocol string looked up in PROJECT_MAP
  defillamaChain: string,   // was: chain string looked up in CHAIN_MAP
  asset: string
): Promise<{ apy: number; tvlUsd: number; utilisationDecimal: number | null } | null>
```

Update the `/api/apys` route to pass the right values. The route receives
`protocol` and `chain` as query params. It needs to look up the plugin and
pass `plugin.defillamaSlug` and `chainPlugin.defillamaChain`:

```ts
// app/api/apys/route.ts
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { CHAIN_REGISTRY } from '@/lib/plugins/chains'

const protocolPlugin = PROTOCOL_REGISTRY[protocol as ProtocolId]
const chainPlugin = CHAIN_REGISTRY[chain as ChainId]

if (!protocolPlugin || !chainPlugin) {
  return NextResponse.json({ error: 'Unknown protocol or chain' }, { status: 400 })
}

const result = await findPoolApy(
  protocolPlugin.defillamaSlug,
  chainPlugin.defillamaChain,
  asset
)
```

---

## Step 2 — Add `defillamaChain` to chain plugins

Each chain plugin needs to declare its DeFi Llama chain name, which differs
from Verdant's internal `ChainId`. This is the same pattern as
`defillamaSlug` on protocol plugins.

### 2a — Extend `ChainPlugin` type

**File:** `frontend/lib/plugins/types/chain-plugin.ts`

Add one field:

```ts
export interface ChainPlugin {
  id: ChainId
  displayName: string
  defillamaChain: string    // ADD — DeFi Llama's chain name string
  // ...rest unchanged
}
```

### 2b — Add `defillamaChain` to each chain plugin

**`frontend/lib/plugins/chains/ethereum.ts`:**
```ts
defillamaChain: 'Ethereum',
```

**`frontend/lib/plugins/chains/arbitrum.ts`:**
```ts
defillamaChain: 'Arbitrum',
```

**`frontend/lib/plugins/chains/base.ts`:**
```ts
defillamaChain: 'Base',
```

**`frontend/lib/plugins/chains/solana.ts`:**
```ts
defillamaChain: 'Solana',
```

DeFi Llama uses title-case chain names. These strings are the canonical
values — do not use lowercase or abbreviated forms anywhere else in the
codebase.

---

## Step 3 — Extend `DepositDestination` type

**File:** `frontend/lib/sequenceBuilder/types.ts`

Replace the current `DepositDestination` interface:

```ts
export interface DepositDestination {
  id: string                  // DeFi Llama pool UUID — stable across fetches
  protocol: ProtocolId
  chain: ChainId
  token: string               // input token symbol (matched from DeFi Llama symbol)
  apy: number                 // current APY, decimal (e.g. 0.068)
  apyMean30d: number | null   // 30-day mean APY, decimal — null if unavailable
  apyBase: number | null      // base lending APY, decimal
  apyReward: number | null    // reward APY on top, decimal
  displayName: string         // e.g. 'Morpho — Gauntlet USDC'
  outputTokenSymbol: string   // e.g. 'gauntletUSDC' — derived from DeFi Llama symbol
  apyType: 'variable' | 'fixed'
  tvlUsd: number
  rewardTokens: string[]      // reward token addresses — for future zap feature
  lockPeriodDays: number | null  // null = no lock; number = explicit lock duration
  lockDescription: string | null // human-readable lock description if locked
}
```

The `lockPeriodDays` and `rewardTokens` fields are populated at fetch time
and carried through to `DepositCard` for display. They do not affect the
sequencer engine.

---

## Step 4 — Build the destinations fetcher

**File:** `frontend/lib/data/destinationsFetcher.ts` (new file)

```ts
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

    // Match token
    const token = extractInputToken(pool.symbol)
    if (!token) continue
    if (filterToken && token !== filterToken.toUpperCase()) continue

    const { lockPeriodDays, lockDescription } = extractLockInfo(pool)

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
      outputTokenSymbol: pool.symbol,  // DeFi Llama symbol is the receipt token
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
```

---

## Step 5 — New `/api/destinations` route

**File:** `frontend/app/api/destinations/route.ts` (new file)

```ts
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchDepositDestinations } from '@/lib/data/destinationsFetcher'
import { ALL_CHAINS, ChainId } from '@/types/shared'

const QuerySchema = z.object({
  token: z.string().optional(),
  chain: z.enum(ALL_CHAINS).optional(),
})

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = QuerySchema.safeParse(params)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid query params', details: result.error.format() },
      { status: 400 }
    )
  }

  const { token, chain } = result.data

  try {
    const destinations = await fetchDepositDestinations(token, chain as ChainId | undefined)
    return NextResponse.json(
      { destinations },
      {
        headers: {
          // Cache at CDN/edge for 5 min, serve stale for up to 15 min while revalidating
          'Cache-Control': 's-maxage=300, stale-while-revalidate=900',
        },
      }
    )
  } catch (error) {
    console.error('Destinations fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deposit destinations' },
      { status: 500 }
    )
  }
}
```

---

## Step 6 — Client-side hook

**File:** `frontend/hooks/useDestinations.ts` (new file)

```ts
'use client'

import { useState, useEffect } from 'react'
import { DepositDestination } from '@/lib/sequenceBuilder/types'
import { ChainId } from '@/types/shared'

interface UseDestinationsResult {
  destinations: DepositDestination[]
  isLoading: boolean
  error: string | null
}

export function useDestinations(token: string, chain: ChainId): UseDestinationsResult {
  const [destinations, setDestinations] = useState<DepositDestination[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !chain) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({ token, chain })
    fetch(`/api/destinations?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (!cancelled) {
          setDestinations(data.destinations ?? [])
          setIsLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setIsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [token, chain])

  return { destinations, isLoading, error }
}
```

In demo mode, this hook still hits `/api/destinations` — and it works, because
the API route calls `fetchPoolApys()` which hits DeFi Llama. Demo mode only
mocks wallet and transaction execution, not read-only data fetching.

If you want the demo to be fully offline, add a demo branch:

```ts
const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// At top of useEffect:
if (isDemo) {
  // Fall back to static fixture destinations from the old DEPOSIT_DESTINATIONS
  import('@/lib/sequenceBuilder/destinations').then(m => {
    if (!cancelled) {
      setDestinations(m.getDepositDestinations(token, chain))
      setIsLoading(false)
    }
  })
  return
}
```

This is optional — your call on whether demo needs to be fully offline.

---

## Step 7 — Update `DepositCard` to use the hook

**File:** `frontend/components/sequenceBuilder/DepositCard.tsx`

Replace the synchronous `getDepositDestinations()` call with `useDestinations`:

```tsx
import { useDestinations } from '@/hooks/useDestinations'

export function DepositCard({ tokenIn, ... }) {
  const { destinations, isLoading, error } = useDestinations(tokenIn.token, tokenIn.chain)
  // ...
}
```

### Loading state

Replace the empty list with a loading skeleton while `isLoading`:

```tsx
{isLoading && (
  <div className="space-y-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-12 bg-verdant-surface-accent rounded animate-pulse" />
    ))}
  </div>
)}
```

### Error state

```tsx
{error && !isLoading && (
  <div className="text-xs text-verdant-loss text-center py-4">
    Failed to load destinations. <button onClick={() => refetch()} className="underline">Retry</button>
  </div>
)}
```

Add a `refetch` mechanism to `useDestinations` by exposing a `refetch: () =>
void` that increments a counter in the `useEffect` dep array.

### Updated destination row

Each row now shows current APY, 30d mean, reward tokens, and lock indicator:

```tsx
<div
  key={dest.id}
  onClick={() => handleRowClick(dest)}
  className={`p-2 rounded text-xs cursor-pointer border transition-colors ${
    isSel
      ? 'bg-verdant-surface-accent border-verdant-moss border-l-2'
      : 'border-[#E5E0D8] hover:bg-[#FAF9F6]'
  }`}
>
  {/* Name row */}
  <div className="font-medium text-verdant-text-primary leading-snug flex items-center gap-1">
    {dest.displayName}
    {dest.lockPeriodDays != null && (
      <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200
                       px-1 py-0.5 rounded font-semibold uppercase tracking-wide">
        🔒 {dest.lockPeriodDays}d
      </span>
    )}
    {dest.lockDescription && dest.lockPeriodDays == null && (
      <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200
                       px-1 py-0.5 rounded font-semibold uppercase tracking-wide">
        🔒 Locked
      </span>
    )}
  </div>

  {/* APY row */}
  <div className="flex items-center justify-between mt-1 text-[10px]">
    <span className="text-verdant-text-muted capitalize">{dest.chain}</span>
    <div className="flex items-center gap-1.5">
      {dest.apyMean30d != null && (
        <span className="text-verdant-text-muted font-mono">
          {formatPercent(dest.apyMean30d)} 30d
        </span>
      )}
      <span className="font-mono font-semibold text-verdant-profit">
        {formatPercent(dest.apy)}
      </span>
    </div>
  </div>

  {/* Reward tokens */}
  {dest.rewardTokens.length > 0 && (
    <div className="flex gap-1 mt-1 flex-wrap">
      {dest.rewardTokens.slice(0, 3).map((addr, i) => (
        <span
          key={i}
          className="text-[9px] bg-verdant-surface-accent text-verdant-text-muted
                     border border-[#D5E8E0] px-1 py-0.5 rounded font-mono"
        >
          +{addr.slice(0, 6)}
        </span>
      ))}
    </div>
  )}
</div>
```

Note on reward token display: DeFi Llama returns contract addresses in
`rewardTokens`, not symbols. For now, show the truncated address. A future
token symbol resolution pass (via DeFi Llama's Coins API) can replace this
without a type change — the `rewardTokens: string[]` field on
`DepositDestination` is already the right shape for either addresses or
symbols.

### Updated completed (read-only) card

Show both APY values and the lock badge in the compact summary:

```tsx
<div className="text-xs text-verdant-text-muted mt-1 capitalize">
  {selectedDestination.chain} ·{' '}
  <span className="font-mono font-semibold text-verdant-profit">
    {formatPercent(selectedDestination.apy)}
  </span>
  {selectedDestination.apyMean30d != null && (
    <span className="font-mono text-verdant-text-muted ml-1">
      ({formatPercent(selectedDestination.apyMean30d)} 30d avg)
    </span>
  )}
  {selectedDestination.lockPeriodDays != null && (
    <span className="ml-1 text-amber-600">· 🔒 {selectedDestination.lockPeriodDays}d lock</span>
  )}
</div>
```

---

## Step 8 — Remove static fallback

**File:** `frontend/lib/sequenceBuilder/destinations.ts`

The `DEPOSIT_DESTINATIONS` static array and `getDepositDestinations` function
are replaced by the live fetcher. However:

- Keep the file but replace its contents with a re-export of `fetchDepositDestinations`
  so any future server-side callers have a clean import path:

```ts
// lib/sequenceBuilder/destinations.ts
// Static DEPOSIT_DESTINATIONS removed — use fetchDepositDestinations from lib/data/destinationsFetcher
// or useDestinations hook for client-side access.
export { fetchDepositDestinations, } from '@/lib/data/destinationsFetcher'
```

- Keep `getDepositDestinations` as a function for demo mode only, if you chose
  to implement the offline demo branch in Step 6. Move it inline into the
  demo import rather than exporting it.

---

## Adding a new protocol — checklist

When a new protocol is added to Verdant (e.g. Compound, Spark), these are
the only changes needed to make it appear in the deposit dropdown:

1. Create `lib/plugins/protocols/compound.ts` with `defillamaSlug: 'compound-v3'`
2. Add `compound: compoundPlugin` to `PROTOCOL_REGISTRY` in
   `lib/plugins/protocols/index.ts`
3. Add `buildTx` for supply/deposit action

No changes to `destinationsFetcher.ts`, `defillama.ts`, or any route. The
registry lookup in `buildProtocolLookup()` picks it up automatically.

---

## Acceptance checklist

- [ ] `DefillamaPool` type includes `apyMean30d`, `audits`, `exposure`,
      `poolMeta`, `underlyingTokens`, `rewardTokens`, `ilRisk`, `category`
- [ ] `fetchPoolApys` maps all new fields from the API response
- [ ] Cache TTL is 15 minutes
- [ ] `PROJECT_MAP` and `CHAIN_MAP` removed from `defillama.ts`
- [ ] `findPoolApy` accepts `defillamaSlug` and `defillamaChain` directly
- [ ] `/api/apys` route reads slug from plugin registry, not hardcoded map
- [ ] `ChainPlugin` type has `defillamaChain: string`
- [ ] All four chain plugins declare `defillamaChain`
- [ ] `DepositDestination` type has `apyMean30d`, `apyBase`, `apyReward`,
      `tvlUsd`, `rewardTokens`, `lockPeriodDays`, `lockDescription`
- [ ] `fetchDepositDestinations` filters: TVL ≥ $1M, audited, single exposure,
      registered protocol, registered chain, parseable symbol
- [ ] `fetchDepositDestinations` excludes LP categories
- [ ] Lock detection reads `poolMeta` for lock/vest/unbonding keywords
- [ ] `buildChainLookup` and `buildProtocolLookup` are derived from registries,
      no hardcoded strings
- [ ] `/api/destinations` route uses `z.enum(ALL_CHAINS)` for chain param
- [ ] `/api/destinations` returns `Cache-Control: s-maxage=300, stale-while-revalidate=900`
- [ ] `useDestinations` hook cleans up on unmount (`cancelled = true`)
- [ ] `DepositCard` shows loading skeleton while fetching
- [ ] `DepositCard` shows error state with retry button on failure
- [ ] Each destination row shows: current APY, 30d mean APY, lock badge if locked,
      reward token badges if any
- [ ] Lock badge uses amber colour, never blocks selection
- [ ] Reward tokens show truncated address (first 6 chars) as placeholder
- [ ] Completed (read-only) card shows both APY values and lock if present
- [ ] `server-only` is the first import in `destinationsFetcher.ts`
- [ ] No `as any` introduced
- [ ] Adding a new protocol to `PROTOCOL_REGISTRY` with a `defillamaSlug`
      causes it to appear in the dropdown with no other changes