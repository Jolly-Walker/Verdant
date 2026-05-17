import { RawPosition, PositionType } from "@/types/shared"

export interface Reward {
  token: string
  amount: string
  amountUsd: number
}

export interface Position extends RawPosition {
  // Enriched fields added by aggregation pipeline
  priceUsd: number           // current token price
  percentChange24h?: number  // from Defillama
  
  // Borrow-specific
  healthFactor?: number
  liquidationPrice?: number
  borrowApy?: number
  
  // Pendle-specific
  maturityDate?: string      // string for serialisation (Date in spec, but typically string in API responses)
  fixedApy?: number          // for PT
  impliedApy?: number        // for YT
  underlyingAsset?: string
  
  // LP-specific (future)
  token0?: string
  token1?: string
  feeTier?: number
}

// Re-export PositionType for convenience
export type { PositionType }
