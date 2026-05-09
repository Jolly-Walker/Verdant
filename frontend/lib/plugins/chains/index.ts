import { ChainId } from '../types/shared'
import { ChainPlugin } from '../types/chain-plugin'
import { ethereumPlugin } from './ethereum'
import { arbitrumPlugin } from './arbitrum'
import { basePlugin } from './base'

export const CHAIN_REGISTRY: Record<ChainId, ChainPlugin> = {
  ethereum: ethereumPlugin,
  arbitrum: arbitrumPlugin,
  base: basePlugin,
  solana: {} as ChainPlugin, // Placeholder for solana
}
