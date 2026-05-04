import { ChainPlugin } from '../types/chain-plugin'

export const ethereumPlugin: ChainPlugin = {
  id: 'ethereum',
  displayName: 'Ethereum',
  chainIdOrNetwork: 1,
  family: 'evm',
  explorerUrl: 'https://etherscan.io',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'WBTC', 'wstETH'],
  
  async getRpcClient() {
    const { createPublicClient, http } = await import('viem')
    const { mainnet } = await import('viem/chains')
    
    const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_ETHEREUM || ''}`
    
    return createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl)
    })
  },

  async estimateGasCostUsd(tx: unknown): Promise<number> {
    // Basic estimation: ~200k gas for complex tx, ~21k for simple
    const gasLimit = 150000n 
    const gasPriceGwei = 20n 
    const ethPriceUsd = 3500
    
    // cost = gasLimit * gasPriceGwei * 1e9 / 1e18
    const costEth = (gasLimit * gasPriceGwei) / 1000000000n 
    return Number(costEth) * ethPriceUsd / 1e9 // Result in USD
  }
}
