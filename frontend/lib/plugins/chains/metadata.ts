import { ChainId } from '@/types/shared'

export interface ChainDisplayMetadata {
  id: ChainId
  displayName: string
  explorerUrl: string
  family: 'evm' | 'solana'
  nativeCurrency: { symbol: string; decimals: number }
  chainIdOrNetwork: number | string
  coingeckoId: string
}

export const CHAIN_DISPLAY_MAP: Record<ChainId, ChainDisplayMetadata> = {
  ethereum: {
    id: 'ethereum',
    displayName: 'Ethereum',
    explorerUrl: 'https://etherscan.io',
    family: 'evm',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    chainIdOrNetwork: 1,
    coingeckoId: 'ethereum'
  },
  arbitrum: {
    id: 'arbitrum',
    displayName: 'Arbitrum One',
    explorerUrl: 'https://arbiscan.io',
    family: 'evm',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    chainIdOrNetwork: 42161,
    coingeckoId: 'ethereum'
  },
  base: {
    id: 'base',
    displayName: 'Base',
    explorerUrl: 'https://basescan.org',
    family: 'evm',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    chainIdOrNetwork: 8453,
    coingeckoId: 'ethereum'
  },
  solana: {
    id: 'solana',
    displayName: 'Solana',
    explorerUrl: 'https://explorer.solana.com',
    family: 'solana',
    nativeCurrency: { symbol: 'SOL', decimals: 9 },
    chainIdOrNetwork: 'solana-mainnet',
    coingeckoId: 'solana'
  },
}
