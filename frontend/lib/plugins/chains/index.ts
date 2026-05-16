import { ChainId } from '../types/shared'
import { ChainPlugin } from '../types/chain-plugin'
import { ethereumPlugin } from './ethereum'
import { arbitrumPlugin } from './arbitrum'
import { basePlugin } from './base'
import { solanaPlugin } from './solana'

export * from './metadata'

export const CHAIN_REGISTRY: Record<ChainId, ChainPlugin> = {
  ethereum: ethereumPlugin,
  arbitrum: arbitrumPlugin,
  base: basePlugin,
  solana: solanaPlugin,
}
