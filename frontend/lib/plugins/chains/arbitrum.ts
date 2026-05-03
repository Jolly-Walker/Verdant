import { ChainPlugin } from '../types/chain-plugin'

export const arbitrumPlugin: ChainPlugin = {
  id: 'arbitrum',
  displayName: 'Arbitrum One',
  chainIdOrNetwork: 42161,
  family: 'evm',
  explorerUrl: 'https://arbiscan.io',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'WBTC', 'wstETH'],
  getRpcClient: async () => { throw new Error('Not implemented') },
  estimateGasCostUsd: async () => 0,
}
