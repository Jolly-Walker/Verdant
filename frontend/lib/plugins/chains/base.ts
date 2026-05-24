import { ChainPlugin } from '../types/chain-plugin'
import { PublicClient } from 'viem'
import { Connection } from '@solana/web3.js'

export const basePlugin: ChainPlugin = {
  id: 'base',
  displayName: 'Base',
  defillamaChain: 'Base',
  chainIdOrNetwork: 8453,
  family: 'evm',
  explorerUrl: 'https://basescan.org',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'cbETH'],
  
  async getRpcClient(): Promise<PublicClient | Connection> {
    const { getPublicClient } = await import('@/lib/server/rpc')
    return getPublicClient('base')
  },

  async estimateGasCostUsd(_tx: unknown): Promise<number> {
    const { fetchGasPrice } = await import('@/lib/server/rpc')
    const { getEthPrice } = await import('@/lib/data/prices')
    
    // Default to a reasonable limit for complex txs
    const gasLimit = 250000n 
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
