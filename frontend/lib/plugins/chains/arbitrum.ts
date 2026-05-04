import { ChainPlugin } from '../types/chain-plugin'

export const arbitrumPlugin: ChainPlugin = {
  id: 'arbitrum',
  displayName: 'Arbitrum One',
  chainIdOrNetwork: 42161,
  family: 'evm',
  explorerUrl: 'https://arbiscan.io',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'WBTC', 'wstETH'],

  async getRpcClient() {
    const { createPublicClient, http } = await import('viem')
    const { arbitrum } = await import('viem/chains')
    
    const rpcUrl = `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_ARBITRUM || ''}`
    
    return createPublicClient({
      chain: arbitrum,
      transport: http(rpcUrl)
    })
  },

  async estimateGasCostUsd(tx: unknown): Promise<number> {
    // Arbitrum is much cheaper than L1
    // Return a mock value for now as requested in Milestone 2
    return 0.50 // Mock $0.50 for Arbitrum
  }
}
