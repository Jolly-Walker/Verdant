import 'server-only'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { autoCompoundSettings } from '@/lib/db/schema'

/** Shape returned to the client (snake_case to match the harvest UI). */
export interface AutoCompoundSetting {
  protocol: string
  chain: string
  asset: string
  enabled: boolean
  min_threshold_usd: number | null
}

export interface UpsertAutoCompoundSettingInput {
  address: string
  protocol: string
  chain: string
  asset: string
  enabled: boolean
  minThresholdUsd?: number
}

/** Returns auto-compound settings for all positions belonging to a wallet. */
export async function getAutoCompoundSettings(
  walletAddress: string
): Promise<AutoCompoundSetting[]> {
  const rows = await getDb()
    .select({
      protocol: autoCompoundSettings.protocol,
      chain: autoCompoundSettings.chain,
      asset: autoCompoundSettings.asset,
      enabled: autoCompoundSettings.enabled,
      minThresholdUsd: autoCompoundSettings.minThresholdUsd,
    })
    .from(autoCompoundSettings)
    .where(eq(autoCompoundSettings.walletAddress, walletAddress))

  return rows.map((r) => ({
    protocol: r.protocol,
    chain: r.chain,
    asset: r.asset,
    enabled: r.enabled ?? false,
    min_threshold_usd: r.minThresholdUsd != null ? Number(r.minThresholdUsd) : null,
  }))
}

/** Inserts or updates the auto-compound setting for a wallet+protocol+chain+asset. */
export async function upsertAutoCompoundSetting(
  input: UpsertAutoCompoundSettingInput
): Promise<void> {
  const threshold =
    input.minThresholdUsd !== undefined ? { minThresholdUsd: String(input.minThresholdUsd) } : {}

  await getDb()
    .insert(autoCompoundSettings)
    .values({
      walletAddress: input.address,
      protocol: input.protocol,
      chain: input.chain,
      asset: input.asset,
      enabled: input.enabled,
      ...threshold,
    })
    .onConflictDoUpdate({
      target: [
        autoCompoundSettings.walletAddress,
        autoCompoundSettings.protocol,
        autoCompoundSettings.chain,
        autoCompoundSettings.asset,
      ],
      set: { enabled: input.enabled, ...threshold },
    })
}
