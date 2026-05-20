import 'server-only'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { ChainId, ALL_CHAINS, Reward } from '@/types/shared'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const RewardsQuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM wallet address'),
  chain: z.enum(ALL_CHAINS).optional(),
})

export interface AggregatedReward extends Reward {
  protocol: string
  chain: ChainId
}

/**
 * GET /api/rewards
 *
 * Aggregates claimable rewards across all protocol plugins that implement
 * the optional `rewards` (RewardFetcher) interface.
 *
 * Query params:
 *   - address: EVM wallet address (required)
 *   - chain:   filter to a specific chain (optional; fetches all supported chains if omitted)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = {
    address: searchParams.get('address') ?? undefined,
    chain: searchParams.get('chain') ?? undefined,
  }

  const result = RewardsQuerySchema.safeParse(query)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const { address, chain: chainFilter } = result.data

  const rewardPromises: Promise<AggregatedReward[]>[] = []

  for (const [pluginId, plugin] of Object.entries(PROTOCOL_REGISTRY)) {
    if (!plugin.rewards) continue

    const chainsToFetch: ChainId[] = chainFilter
      ? (plugin.supportedChains.includes(chainFilter as ChainId) ? [chainFilter as ChainId] : [])
      : plugin.supportedChains.filter(c => c !== 'solana') // EVM only for now

    for (const chain of chainsToFetch) {
      rewardPromises.push(
        plugin.rewards
          .fetchRewards(address!, chain)
          .then((rewards: Reward[]) =>
            rewards.map((r) => ({ ...r, protocol: pluginId, chain }))
          )
          .catch((err) => {
            console.error(`[rewards] Failed to fetch rewards for ${pluginId} on ${chain}:`, err)
            return []
          })
      )
    }
  }

  const rewardArrays = await Promise.all(rewardPromises)
  const rewards = rewardArrays.flat()
  const totalUsd = rewards.reduce((sum, r) => sum + r.amountUsd, 0)

  return NextResponse.json(
    { rewards, totalUsd },
    {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
      },
    }
  )
}
