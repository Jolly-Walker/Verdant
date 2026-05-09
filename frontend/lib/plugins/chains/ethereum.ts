import { ChainPlugin } from '../types/chain-plugin'
import { PublicClient } from 'viem'
import { Connection } from '@solana/web3.js'

export const ethereumPlugin: ChainPlugin = {
  id: 'ethereum',
  displayName: 'Ethereum',
  chainIdOrNetwork: 1,
  family: 'evm',
  explorerUrl: 'https://etherscan.io',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'WBTC', 'wstETH'],
  
  async getRpcClient(): Promise<PublicClient | Connection> {
    const { getPublicClient } = await import('@/lib/server/rpc')
    return getPublicClient('ethereum')
  },

  async estimateGasCostUsd(_tx: unknown): Promise<number> {
    const { fetchGasPrice } = await import('@/lib/server/rpc')
    const { getEthPrice } = await import('@/lib/data/prices')

    // Default to a reasonable limit for complex txs if no tx provided
    const gasLimit = 250000n 
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
