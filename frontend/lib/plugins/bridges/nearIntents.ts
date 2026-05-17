import 'server-only'
import { BridgePlugin } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '@/types/shared'

export const nearIntentsBridgePlugin: BridgePlugin = {
  id: 'nearIntents',
  displayName: 'NEAR Intents',
  supportedTokens: ['ETH', 'USDC', 'SOL'],
  supportedRoutes: [
    { from: 'ethereum', to: 'solana' },
    { from: 'arbitrum', to: 'solana' },
    { from: 'base', to: 'solana' },
  ],

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    const amountOutStr = ((BigInt(params.amount) * BigInt(995)) / BigInt(1000)).toString();

    return {
      bridgeId: 'nearIntents',
      feeUsd: 2.0,
      estimatedTimeSeconds: 60,
      expectedOutputAmount: amountOutStr,
      slippagePercent: 0.5,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      rawQuote: { intentId: `intent_${Math.random().toString(36).substring(2, 11)}` }
    }
  },

  async buildBridgeTx(_quote: BridgeQuote): Promise<UnsignedTx> {
    return {
      chainId: 1, // Mock numeric ID
      to: '0x0000000000000000000000000000000000000000', // Mock solver address
      data: '0x',
      value: BigInt(0),
      description: `Bridge tokens via NEAR Intents`,
    }
  },

  async pollStatus(_txHash: string, _fromChain: ChainId): Promise<BridgeStatus> {
    // Default to pending for safety until implementation is complete (M7)
    return {
      status: 'pending'
    }
  }
}
