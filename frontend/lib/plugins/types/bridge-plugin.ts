import { BridgeId, TokenSymbol, ChainId, BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus } from '@/types/shared'

/**
 * Optional context for status polling. Some bridges (e.g. NEAR Intents) track
 * delivery by a deposit address rather than the source tx hash. Callers pass
 * what they have; plugins that don't need it ignore it.
 */
export interface BridgeStatusContext {
  depositAddress?: string
}

export interface BridgePlugin {
  id: BridgeId
  displayName: string
  supportedTokens: TokenSymbol[]
  supportedRoutes: Array<{ from: ChainId; to: ChainId }>
  getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null>
  buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx>
  pollStatus(txHash: string, fromChain: ChainId, context?: BridgeStatusContext): Promise<BridgeStatus>
}
