import 'server-only'
import { BridgeId, BridgeQuote, BridgeQuoteParams } from '@/types/shared'
import { BridgePlugin } from '../types/bridge-plugin'
import { acrossBridgePlugin } from './across'
import { nearIntentsBridgePlugin } from './nearIntents'

export const BRIDGE_REGISTRY: Record<BridgeId, BridgePlugin> = {
  across: acrossBridgePlugin,
  nearIntents: nearIntentsBridgePlugin,
  layerzero: {
    id: 'layerzero',
    displayName: 'LayerZero',
    supportedTokens: ['USDC'],
    supportedRoutes: [],
    getQuote: async () => null,
    buildBridgeTx: async () => ({ chainId: 'ethereum', to: '', data: '', value: BigInt(0), description: '' }),
    pollStatus: async () => ({ status: 'pending' })
  },
  chainlink: {
    id: 'chainlink',
    displayName: 'Chainlink CCIP',
    supportedTokens: ['ETH', 'USDC', 'LINK'],
    supportedRoutes: [],
    getQuote: async () => null,
    buildBridgeTx: async () => ({ chainId: 'ethereum', to: '', data: '', value: BigInt(0), description: '' }),
    pollStatus: async () => ({ status: 'pending' })
  }
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
    .sort((a, b) => Number(b.expectedOutputAmount) - Number(a.expectedOutputAmount))
}
