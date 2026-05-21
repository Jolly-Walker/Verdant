import { ProtocolId, ChainId, BridgeQuote } from "./shared"

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

export interface StepCost {
  stepLabel: string
  chain: ChainId
  gasCostUsd: number
  bridgeFeeUsd?: number
  slippageUsd?: number
}

export interface CostPreviewResult {
  steps: StepCost[]
  totalCostUsd: number
  currentApyDecimal: number
  targetApyDecimal: number
  netUpliftDecimal: number | null
  dailyYieldGainUsd: number | null
  breakEvenDays: number | null
  /** Target pool utilisation as decimal (e.g. 0.95 = 95%). Null if unavailable. */
  targetUtilisationDecimal: number | null
  quoteFetchedAt: Date
  warnings: Warning[]
  bridgeOptions?: BridgeQuote[]
}
