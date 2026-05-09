import { ChainId, TokenSymbol } from './shared'
import { PublicClient } from 'viem'

export interface ChainPlugin {
  id: ChainId
  displayName: string
  chainIdOrNetwork: number | string
  family: 'evm' | 'solana'
  explorerUrl: string
  nativeCurrency: { symbol: string; decimals: number }
  bridgeableTokens: TokenSymbol[]
  estimateGasCostUsd(tx: unknown): Promise<number>
}
