import { ChainId } from '../types/shared'
import { ChainPlugin } from '../types/chain-plugin'
import { ethereumPlugin } from './ethereum'
import { arbitrumPlugin } from './arbitrum'

export const CHAIN_REGISTRY: Record<ChainId, ChainPlugin> = {
  ethereum: ethereumPlugin,
  arbitrum: arbitrumPlugin,
  base: {} as ChainPlugin, // Placeholder for base
  solana: {} as ChainPlugin, // Placeholder for solana
}
