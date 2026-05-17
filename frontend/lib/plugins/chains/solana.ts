import { ChainPlugin } from '../types/chain-plugin'
import { ChainId } from '@/types/shared'

export const solanaPlugin: ChainPlugin = {
  id: 'solana' as ChainId,
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
}
