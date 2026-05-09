import { ChainPlugin } from '../types/chain-plugin'
import { PublicClient } from 'viem'
import { Connection } from '@solana/web3.js'

export const arbitrumPlugin: ChainPlugin = {
  id: 'arbitrum',
  displayName: 'Arbitrum One',
  chainIdOrNetwork: 42161,
  family: 'evm',
  explorerUrl: 'https://arbiscan.io',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'WBTC', 'wstETH'],

  async getRpcClient(): Promise<PublicClient | Connection> {
    const { getPublicClient } = await import('@/lib/server/rpc')
    return getPublicClient('arbitrum')
  },

  async estimateGasCostUsd(_tx: unknown): Promise<number> {
    const { fetchGasPrice } = await import('@/lib/server/rpc')
    const { getEthPrice } = await import('@/lib/data/prices')

    const gasLimit = 800000n // Arbitrum gas limits are higher but price is lower
    const [gasPriceGwei, ethPrice] = await Promise.all([
      fetchGasPrice('arbitrum'),
      getEthPrice()
    ])
    
    const gasPriceWei = BigInt(Math.floor(gasPriceGwei * 1e9))
    const costWei = gasLimit * gasPriceWei
    const costEth = Number(costWei) / 1e18
    return costEth * ethPrice
  }
}
