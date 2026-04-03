import { Protocol } from "./protocol"
import { Chain } from "./chain"

export interface CostPreviewInput {
  asset: string
  amountUsd: number
  sourceProtocol: Protocol
  sourceChain: Chain
  destProtocol: Protocol
  destChain: Chain
}

export interface Warning {
  type: string
  message: string
}

export interface CostPreviewResult {
  bridgeFeeUsd: number        // from Across API quote
  slippageUsd: number         // from NEAR Intents quote (amountIn - amountOut in USD)
  gasStep1Usd: number         // eth_estimateGas × gasPrice × ETH price
  gasStep2Usd: number         // eth_estimateGas on dest × dest gas price × ETH price
  totalSwitchingCostUsd: number
  currentApyDecimal: number   // from Defillama
  targetApyDecimal: number    // from Defillama
  netUpliftDecimal: number
  dailyYieldGainUsd: number
  breakEvenDays: number
  quoteFetchedAt: Date
  warnings: Warning[]
}
