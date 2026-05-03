import { ChainPlugin } from '../types/chain-plugin'

export const ethereumPlugin: ChainPlugin = {
  id: 'ethereum',
  displayName: 'Ethereum',
  chainIdOrNetwork: 1,
  family: 'evm',
  explorerUrl: 'https://etherscan.io',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  bridgeableTokens: ['ETH', 'USDC', 'USDT', 'WBTC', 'wstETH'], // based on SUPPORTED_TOKENS from constants/chains.ts (migrated mentally)
  getRpcClient: async () => { throw new Error('Not implemented') },
  estimateGasCostUsd: async () => 0,
}
