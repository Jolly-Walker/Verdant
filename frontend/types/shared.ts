export const ALL_CHAINS = ['ethereum', 'arbitrum', 'base', 'solana'] as const
export type ChainId = (typeof ALL_CHAINS)[number]

export const ALL_PROTOCOLS = ['aave', 'morpho', 'pendle', 'euler'] as const
export type ProtocolId = (typeof ALL_PROTOCOLS)[number] | string

export const ALL_BRIDGES = ['across', 'layerzero', 'nearIntents'] as const
export type BridgeId = (typeof ALL_BRIDGES)[number]

export const ALL_TOKENS = ['ETH', 'USDC', 'USDT', 'WBTC', 'wstETH', 'SOL'] as const
export type TokenSymbol = (typeof ALL_TOKENS)[number] | string

export type PositionType =
  | 'wallet'
  | 'supply'
  | 'borrow'
  | 'lp'
  | 'stake'
  | 'pendle-pt'
  | 'pendle-yt'
  | 'farm'

export interface Reward {
  token: string
  amount: string
  amountUsd: number
}

export interface RawPosition {
  id: string
  protocol: ProtocolId
  chain: ChainId
  asset: string
  assetAddress: string
  amount: number
  amountUsd: number
  currentApy: number
  positionType: PositionType
  claimableRewards: Reward[]
  metadata: Record<string, unknown>
}

export interface UnsignedTx {
  /** Numeric ID for EVM; 'solana-mainnet' for Solana */
  chainId: number | string
  to: string
  data: string
  value: bigint
  description: string
  gasLimit?: bigint
}

export interface TxBuildParams {
  action: 'supply' | 'withdraw' | 'borrow' | 'repay' | 'stake' | 'unstake' | 'claim'
  protocol: ProtocolId
  chain: ChainId
  asset: string
  amount: string
  userAddress: string
  extraParams?: Record<string, unknown>
}

export interface BridgeQuoteParams {
  fromChain: ChainId
  toChain: ChainId
  token: TokenSymbol
  amount: string
  recipientAddress: string
}

export interface BridgeQuote {
  bridgeId: BridgeId
  feeUsd: number
  estimatedTimeSeconds: number
  expectedOutputAmount: string
  slippagePercent: number
  expiresAt: Date
  rawQuote: unknown
}

export interface BridgeStatus {
  status: 'pending' | 'complete' | 'failed'
  destinationTxHash?: string
  errorMessage?: string
}
