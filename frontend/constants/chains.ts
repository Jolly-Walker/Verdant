import { Chain } from '@/types/chain'

export interface ChainConfig {
  chainId: number
  name: string
  displayName: string
  explorerUrl: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

/**
 * Client-safe chain configuration.
 * RPC URLs are intentionally excluded — they contain API keys and must only
 * be constructed server-side via lib/server/rpc.ts.
 */
export const SUPPORTED_CHAINS: Record<Chain, ChainConfig> = {
  ethereum: {
    chainId: 1,
    name: 'ethereum',
    displayName: 'Ethereum',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  arbitrum: {
    chainId: 42161,
    name: 'arbitrum',
    displayName: 'Arbitrum One',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
}

export const CHAIN_ID_MAP: Record<number, Chain> = {
  1: 'ethereum',
  42161: 'arbitrum',
}
