import { BridgeId, TokenSymbol, ChainId, BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus } from '@/types/shared'

export interface BridgePlugin {
  id: BridgeId
  displayName: string
  supportedTokens: TokenSymbol[]
  supportedRoutes: Array<{ from: ChainId; to: ChainId }>
  getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null>
  buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx>
  pollStatus(txHash: string, fromChain: ChainId): Promise<BridgeStatus>
}
