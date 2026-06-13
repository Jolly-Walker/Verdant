import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { harvestHistory } from '@/lib/db/schema'

/** Shape returned to the client (snake_case to match the harvest UI). */
export interface HarvestRecord {
  id: string
  protocol: string
  chain: string
  reward_token: string | null
  reward_amount_usd: number | null
  tx_hash: string | null
  created_at: string | null
}

const HISTORY_LIMIT = 50

/** Returns the most recent harvest events for a wallet, newest first. */
export async function getHarvestHistory(walletAddress: string): Promise<HarvestRecord[]> {
  const rows = await getDb()
    .select({
      id: harvestHistory.id,
      protocol: harvestHistory.protocol,
      chain: harvestHistory.chain,
      rewardToken: harvestHistory.rewardToken,
      rewardAmountUsd: harvestHistory.rewardAmountUsd,
      txHash: harvestHistory.txHash,
      createdAt: harvestHistory.createdAt,
    })
    .from(harvestHistory)
    .where(eq(harvestHistory.walletAddress, walletAddress))
    .orderBy(desc(harvestHistory.createdAt))
    .limit(HISTORY_LIMIT)

  return rows.map((r) => ({
    id: r.id,
    protocol: r.protocol,
    chain: r.chain,
    reward_token: r.rewardToken,
    reward_amount_usd: r.rewardAmountUsd != null ? Number(r.rewardAmountUsd) : null,
    tx_hash: r.txHash,
    created_at: r.createdAt ? r.createdAt.toISOString() : null,
  }))
}
