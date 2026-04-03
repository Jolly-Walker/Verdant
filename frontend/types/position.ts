import { Protocol } from "./protocol"
import { Chain } from "./chain"

export interface Reward {
  token: string
  amount: number
  amountUsd: number
}

export interface ProtocolMetadata {
  [key: string]: string | number | boolean | null | undefined
}

export interface Position {
  id: string
  protocol: Protocol
  chain: Chain
  asset: string              // token symbol
  assetAddress: string
  amount: number             // token amount
  amountUsd: number          // USD value
  currentApy: number         // as decimal e.g. 0.065 = 6.5%
  claimableRewards: Reward[]
  positionType: 'supply' | 'borrow' | 'lp'
  metadata: ProtocolMetadata // protocol-specific data
}
