import { ChainId, TokenSymbol } from '@/types/shared'
import { PublicClient } from 'viem'
import { Connection } from '@solana/web3.js'

export interface ChainPlugin {
  /** Unique identifier used throughout the codebase */
  id: ChainId
  /** Human-readable name */
  displayName: string
  /** DeFi Llama's chain name string */
  defillamaChain: string
  /** EIP-155 chain ID for EVM; 'solana-mainnet' string for Solana */
  chainIdOrNetwork: number | string
  /** Chain family — determines which wallet adapters apply */
  family: 'evm' | 'solana'
  /** Block explorer base URL */
  explorerUrl: string
  /** Native currency */
  nativeCurrency: { symbol: string; decimals: number }
  /** Supported bridgeable tokens on this chain */
  bridgeableTokens: TokenSymbol[]
  /**
   * Returns a viem PublicClient (EVM) or Connection (Solana).
   * RPC URL is constructed server-side only.
   */
  getRpcClient(): Promise<PublicClient | Connection>
  /** Estimate gas cost in USD for a given tx */
  estimateGasCostUsd(tx: unknown): Promise<number>
}
