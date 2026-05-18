import 'server-only'
import { Position } from '@/types/position'

/**
 * Deduplicates positions, preferring those from protocol-specific SDKs over Zerion.
 * Currently, positions from Zerion have protocol IDs like 'aave', 'morpho', etc.
 * Positions from Solana token balances have protocol ID 'wallet'.
 */
export function deduplicatePositions(positions: Position[]): Position[] {
  const seen = new Map<string, Position>()

  for (const pos of positions) {
    // Construct a unique key for the position
    // protocol + chain + assetAddress + positionType
    const key = `${pos.protocol}-${pos.chain}-${pos.assetAddress || pos.asset}-${pos.positionType}`

    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, pos)
      continue
    }

    // Heuristic: prefer enriched positions
    // Positions from Zerion have a priceUsd calculated from value/quantity.
    // Future protocol SDK positions will likely have more metadata.
    // For now, if one has more metadata or specific flags, we could prefer it.
    // If they are both from the same source (e.g. Zerion), we just keep the first one.
    
    // In the future, we might check a 'source' field.
    // For now, just keep the one that might have more data.
    if (Object.keys(pos.metadata || {}).length > Object.keys(existing.metadata || {}).length) {
      seen.set(key, pos)
    }
  }

  return Array.from(seen.values())
}
