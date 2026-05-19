import { ProtocolId, ChainId } from "./shared"

export interface CostPreviewInput {
  asset: string
  amountUsd: number
  sourceProtocol: ProtocolId
  sourceChain: ChainId
  destProtocol: ProtocolId
  destChain: ChainId
  /** Unix ms timestamp of Pendle maturity, if source is a Pendle position */
  pendleMaturityMs?: number
}

export interface Warning {
  type: string
  message: string
}

export interface CostPreviewResult {
  bridgeFeeUsd: number          // from Across API quote
  slippageUsd: number           // from NEAR Intents quote (amountIn - amountOut in USD)
  gasStep1Usd: number           // eth_estimateGas × gasPrice × ETH price
  gasStep2Usd: number           // eth_estimateGas on dest × dest gas price × ETH price
  totalSwitchingCostUsd: number
  currentApyDecimal: number     // from Defillama
  targetApyDecimal: number      // from Defillama
  netUpliftDecimal: number
  dailyYieldGainUsd: number
  breakEvenDays: number
  /** Target pool utilisation as decimal (e.g. 0.95 = 95%). Null if unavailable. */
  targetUtilisationDecimal: number | null
  quoteFetchedAt: Date
  warnings: Warning[]
}
