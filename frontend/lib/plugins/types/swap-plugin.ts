import 'server-only'
import { ChainId, UnsignedTx } from '@/types/shared'

export interface SwapQuoteParams {
  fromChain: ChainId
  fromToken: string
  toToken: string
  amount: string        // in human units
  userAddress: string
  slippagePercent: number
}

export interface SwapQuote {
  aggregator: string
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string      // expected output in human units
  feeUsd: number
  priceImpactPercent: number
  expiresAt: Date
  rawQuote: unknown
}

export interface SwapPlugin {
  id: string
  displayName: string
  supportedChains: ChainId[]
  getQuote(params: SwapQuoteParams): Promise<SwapQuote | null>
  buildSwapTx(quote: SwapQuote, userAddress: string): Promise<UnsignedTx>
}
