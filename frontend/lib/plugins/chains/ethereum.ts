import { ChainPlugin } from '../types/chain-plugin'

export const ethereumPlugin: ChainPlugin = {
  id: 'ethereum',
  displayName: 'Ethereum',
  chainIdOrNetwork: 1,
  family: 'evm',
  explorerUrl: 'https://etherscan.io',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'WBTC', 'wstETH'],
  
  async estimateGasCostUsd(tx: unknown): Promise<number> {
    const { fetchGasPrice } = await import('@/lib/server/rpc')
    const { getEthPrice } = await import('@/lib/data/prices')

    const gasLimit = 200000n 
    const [gasPriceGwei, ethPrice] = await Promise.all([
      fetchGasPrice('ethereum'),
      getEthPrice()
    ])
    
    const gasPriceWei = BigInt(Math.floor(gasPriceGwei * 1e9))
    const costWei = gasLimit * gasPriceWei
    const costEth = Number(costWei) / 1e18
    return costEth * ethPrice
  }
}
