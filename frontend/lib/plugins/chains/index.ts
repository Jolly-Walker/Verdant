import { ChainId } from '../types/shared'
import { ChainPlugin } from '../types/chain-plugin'
import { ethereumPlugin } from './ethereum'
import { arbitrumPlugin } from './arbitrum'
import { basePlugin } from './base'

export const CHAIN_REGISTRY: Record<ChainId, ChainPlugin> = {
  ethereum: ethereumPlugin,
  arbitrum: arbitrumPlugin,
  base: basePlugin,
  solana: {
    id: 'solana',
    displayName: 'Solana',
    chainIdOrNetwork: 'solana-mainnet',
    family: 'solana',
    explorerUrl: 'https://explorer.solana.com',
    nativeCurrency: { symbol: 'SOL', decimals: 9 },
    bridgeableTokens: ['SOL', 'USDC'],
    async getRpcClient() {
      const { Connection } = await import('@solana/web3.js')
      const { getRpcUrl } = await import('@/lib/server/rpc')
      return new Connection(getRpcUrl('solana'))
    },
    async estimateGasCostUsd() {
      return 0.001 // Solana fees are negligible
    }
  },
}
