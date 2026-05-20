import 'server-only'
import { BridgeId, BridgeQuote, BridgeQuoteParams } from '@/types/shared'
import { BridgePlugin } from '../types/bridge-plugin'
import { acrossBridgePlugin } from './across'
import { nearIntentsBridgePlugin } from './nearIntents'
import { layerzeroBridgePlugin } from './layerzero'
import { chainlinkBridgePlugin } from './chainlink'

export const BRIDGE_REGISTRY: Record<BridgeId, BridgePlugin> = {
  across: acrossBridgePlugin,
  nearIntents: nearIntentsBridgePlugin,
  layerzero: layerzeroBridgePlugin,
  chainlink: chainlinkBridgePlugin
}

export async function getBridgeQuotes(
  params: BridgeQuoteParams
): Promise<BridgeQuote[]> {
  const eligible = Object.values(BRIDGE_REGISTRY).filter(b =>
    b.supportedTokens.includes(params.token) &&
    b.supportedRoutes.some(r => r.from === params.fromChain && r.to === params.toChain)
  )
  
  const quotes = await Promise.allSettled(eligible.map(b => b.getQuote(params)))
  
  return quotes
    .filter((r): r is PromiseFulfilledResult<BridgeQuote> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
    .sort((a, b) => {
      const diff = BigInt(b.expectedOutputAmount) - BigInt(a.expectedOutputAmount)
      return diff > 0n ? 1 : diff < 0n ? -1 : 0
    })
}
