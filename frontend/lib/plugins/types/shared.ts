export type ChainId = 'ethereum' | 'arbitrum' | 'base' | 'solana'
export type ProtocolId = 'aave' | 'morpho' | 'pendle' | 'euler' | string
export type BridgeId = 'across' | 'layerzero' | 'nearIntents'
export type TokenSymbol = 'ETH' | 'USDC' | 'USDT' | 'WBTC' | 'wstETH' | 'SOL' | string

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
  chainId: ChainId
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
