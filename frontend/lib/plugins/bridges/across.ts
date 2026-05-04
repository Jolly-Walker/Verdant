import { BridgePlugin } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '../types/shared'

export const acrossBridgePlugin: BridgePlugin = {
  id: 'across',
  displayName: 'Across Protocol',
  supportedTokens: ['ETH', 'USDC', 'USDT', 'WBTC'],
  supportedRoutes: [
    { from: 'ethereum', to: 'arbitrum' },
    { from: 'arbitrum', to: 'ethereum' },
    { from: 'ethereum', to: 'base' },
    { from: 'base', to: 'ethereum' },
    { from: 'arbitrum', to: 'base' },
    { from: 'base', to: 'arbitrum' },
  ],

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    // Basic mock implementation for now as requested in the task
    const feeUsd = 5.0 // Mock fee
    const estimatedTimeSeconds = 120 // 2 minutes
    const slippagePercent = 0.1
    
    return {
      bridgeId: 'across',
      feeUsd,
      estimatedTimeSeconds,
      expectedOutputAmount: params.amount, // Simplified
      slippagePercent,
      expiresAt: new Date(Date.now() + 60 * 1000), // 1 minute
      rawQuote: { mock: true }
    }
  },

  async buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx> {
    return {
      chainId: 'ethereum', // This should really be from the quote's source chain
      to: '0x59728544B08AB483533076417FbBB2fD0B17CE3a', // Across SpokePool
      data: '0x', // Mock data
      value: BigInt(0),
      description: `Bridge tokens via Across`,
    }
  },

  async pollStatus(txHash: string, fromChain: ChainId): Promise<BridgeStatus> {
    try {
      const response = await fetch(`https://across.to/api/deposit/status?originTransactionHash=${txHash}`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        return { status: 'pending' }
      }

      const data = await response.json()
      
      return {
        status: data.status === 'filled' ? 'complete' : 'pending',
        destinationTxHash: data.fillTxs?.[0]?.hash
      }
    } catch (error) {
      console.error('Error polling Across bridge status:', error)
      return { status: 'pending' }
    }
  }
}
