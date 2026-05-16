import { CHAIN_DISPLAY_MAP } from '@/lib/plugins/chains/metadata'
import { ChainId } from '@/lib/plugins/types/shared'

export function useChainMetadata() {
  const getChainMetadata = (chainId: ChainId) => {
    return CHAIN_DISPLAY_MAP[chainId]
  }

  const allChains = Object.values(CHAIN_DISPLAY_MAP)
  
  return {
    getChainMetadata,
    allChains,
    chainIds: Object.keys(CHAIN_DISPLAY_MAP) as ChainId[]
  }
}
