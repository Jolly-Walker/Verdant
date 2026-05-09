import { ChainPlugin } from '../types/chain-plugin'

export const basePlugin: ChainPlugin = {
  id: 'base',
  displayName: 'Base',
  chainIdOrNetwork: 8453,
  family: 'evm',
  explorerUrl: 'https://basescan.org',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'cbETH'],
  
  async estimateGasCostUsd(tx: unknown): Promise<number> {
    const { fetchGasPrice } = await import('@/lib/server/rpc')
    const { getEthPrice } = await import('@/lib/data/prices')
    
    // Default to a reasonable limit for complex txs
    const gasLimit = 200000n 
    const [gasPriceGwei, ethPrice] = await Promise.all([
      fetchGasPrice('base'),
      getEthPrice()
    ])
    
    const gasPriceWei = BigInt(Math.floor(gasPriceGwei * 1e9))
    const costWei = gasLimit * gasPriceWei
    const costEth = Number(costWei) / 1e18
    return costEth * ethPrice
  }
}
