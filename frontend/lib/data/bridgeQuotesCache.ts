import 'server-only'
import { and, desc, eq, gt } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { bridgeQuotesCache } from '@/lib/db/schema'
import { BridgeQuote, ChainId } from '@/types/shared'

export interface BridgeQuoteCacheKey {
  fromChain: ChainId
  toChain: ChainId
  token: string
  /** Amount in wei (stored as text to preserve precision). */
  amount: string
  recipientAddress: string
}

/** How long a cached set of quotes stays valid. */
const CACHE_TTL_MS = 30 * 1000

/** Returns the freshest non-expired cached quotes for a route, or null on a miss. */
export async function getCachedBridgeQuotes(
  key: BridgeQuoteCacheKey
): Promise<BridgeQuote[] | null> {
  const [row] = await getDb()
    .select({ quotes: bridgeQuotesCache.quotes })
    .from(bridgeQuotesCache)
    .where(
      and(
        eq(bridgeQuotesCache.fromChain, key.fromChain),
        eq(bridgeQuotesCache.toChain, key.toChain),
        eq(bridgeQuotesCache.token, key.token),
        eq(bridgeQuotesCache.amountWei, key.amount),
        eq(bridgeQuotesCache.recipient, key.recipientAddress),
        gt(bridgeQuotesCache.expiresAt, new Date())
      )
    )
    .orderBy(desc(bridgeQuotesCache.fetchedAt))
    .limit(1)

  return row ? row.quotes : null
}

/** Stores a fresh set of quotes for a route with a short TTL. */
export async function cacheBridgeQuotes(
  key: BridgeQuoteCacheKey,
  quotes: BridgeQuote[]
): Promise<void> {
  await getDb()
    .insert(bridgeQuotesCache)
    .values({
      fromChain: key.fromChain,
      toChain: key.toChain,
      token: key.token,
      amountWei: key.amount,
      recipient: key.recipientAddress,
      quotes,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    })
}
