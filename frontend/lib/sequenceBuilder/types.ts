import { ChainId, ProtocolId, BridgeId } from '@/types/shared'

export type ActionType =
  | 'deposit'          // terminal
  | 'repay'            // terminal
  | 'withdraw'         // transit
  | 'repayAndWithdraw' // transit
  | 'bridge'           // transit
  | 'swap'             // transit

export type TokenState = {
  token: string           // e.g. 'USDC'
  chain: ChainId
  amount: number          // in human units
  amountUsd: number
  sourcePositionId?: string  // set if token came from a position (supply/borrow), else undefined (wallet)
  positionType?: 'wallet' | 'supply' // what type of holding this token represents at this point
}

export interface DepositDestination {
  id: string                  // DeFi Llama pool UUID — stable across fetches
  protocol: ProtocolId
  chain: ChainId
  token: string               // input token symbol (matched from DeFi Llama symbol)
  apy: number                 // current APY, decimal (e.g. 0.068)
  apyMean30d: number | null   // 30-day mean APY, decimal — null if unavailable
  apyBase: number | null      // base lending APY, decimal
  apyReward: number | null    // reward APY on top, decimal
  displayName: string         // e.g. 'Morpho — Gauntlet USDC'
  outputTokenSymbol: string   // e.g. 'gauntletUSDC' — derived from DeFi Llama symbol
  apyType: 'variable' | 'fixed'
  tvlUsd: number
  rewardTokens: string[]      // reward token addresses — for future zap feature
  lockPeriodDays: number | null  // null = no lock; number = explicit lock duration
  lockDescription: string | null // human-readable lock description if locked
}

export type BuilderStep =
  | { kind: 'source';         tokenOut: TokenState }
  | { kind: 'action-select';  tokenIn: TokenState }
  | { kind: 'deposit';        tokenIn: TokenState; destination: DepositDestination }
  | { kind: 'repay';          tokenIn: TokenState; targetPositionId: string }
  | { kind: 'withdraw';       tokenIn: TokenState; sourcePositionId: string; tokenOut: TokenState }
  | { kind: 'repayAndWithdraw'; tokenIn: TokenState; targetPositionId: string; tokenOut: TokenState }
  | { kind: 'bridge';         tokenIn: TokenState; toChain: ChainId; bridgeId: BridgeId; feeUsd: number; tokenOut: TokenState }
  | { kind: 'swap';           tokenIn: TokenState; toToken: string; feeUsd: number; tokenOut: TokenState }
