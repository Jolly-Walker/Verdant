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
  id: string              // unique — e.g. 'morpho-gauntlet-usdc-base'
  protocol: ProtocolId
  chain: ChainId
  token: string           // input token symbol
  apy: number             // decimal, e.g. 0.068 for 6.8%
  displayName: string     // e.g. 'Morpho — Gauntlet USDC'
  outputTokenSymbol: string // e.g. 'gauntletUSDC'
  apyType: 'variable' | 'fixed'
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
