import { CHAIN_METADATA, ChainMetadata } from '@/lib/plugins/types/chain-metadata'
import { ChainId } from '@/lib/plugins/types/shared'

export function useChainMetadata() {
  const getChainMetadata = (chainId: ChainId): ChainMetadata => {
    return CHAIN_METADATA[chainId]
  }

  const allChains = Object.values(CHAIN_METADATA)
  
  return {
    getChainMetadata,
    allChains,
    chainIds: Object.keys(CHAIN_METADATA) as ChainId[]
  }
}
