import { ChainId } from './shared'

export interface ChainMetadata {
  id: ChainId
  displayName: string
  chainIdOrNetwork: number | string
  family: 'evm' | 'solana'
  explorerUrl: string
  nativeCurrency: { symbol: string; decimals: number }
}

export const CHAIN_METADATA: Record<ChainId, ChainMetadata> = {
  ethereum: {
    id: 'ethereum',
    displayName: 'Ethereum',
    chainIdOrNetwork: 1,
    family: 'evm',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  arbitrum: {
    id: 'arbitrum',
    displayName: 'Arbitrum One',
    chainIdOrNetwork: 42161,
    family: 'evm',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  base: {
    id: 'base',
    displayName: 'Base',
    chainIdOrNetwork: 8453,
    family: 'evm',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  solana: {
    id: 'solana',
    displayName: 'Solana',
    chainIdOrNetwork: 'mainnet-beta',
    family: 'solana',
    explorerUrl: 'https://solscan.io',
    nativeCurrency: { symbol: 'SOL', decimals: 9 },
  }
}
