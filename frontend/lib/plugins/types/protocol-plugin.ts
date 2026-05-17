import { ChainId, ProtocolId, PositionType, RawPosition, UnsignedTx, TxBuildParams, Reward } from '@/types/shared'

export interface ClaimParams {
  address: string
  chain: ChainId
  // Additional params if needed
}

export interface PositionFetcher {
  fetchPositions(address: string, chain: ChainId): Promise<RawPosition[]>
}

export interface TxBuilder {
  buildTx(params: TxBuildParams): Promise<UnsignedTx[]>
  describeAction(params: TxBuildParams): string
}

export interface RewardFetcher {
  fetchRewards(address: string, chain: ChainId): Promise<Reward[]>
  buildClaimTx(params: ClaimParams): Promise<UnsignedTx[]>
}

export interface ProtocolAddresses {
  poolAddress?: string
  [key: string]: string | undefined
}

export interface ProtocolPlugin {
  id: ProtocolId
  displayName: string
  supportedChains: ChainId[]
  supportedPositionTypes: PositionType[]
  defillamaSlug: string
  addresses: Partial<Record<ChainId, ProtocolAddresses>>
  fetcher: PositionFetcher
  builder: TxBuilder
  rewards?: RewardFetcher
}
