import { Chain } from '@/types/chain'
import { CHAIN_METADATA } from '@/lib/plugins/types/chain-metadata'

/**
 * Get a block explorer URL for a transaction hash.
 */
export function getExplorerTxUrl(chain: Chain, txHash: string): string {
  const config = CHAIN_METADATA[chain]
  return `${config.explorerUrl}/tx/${txHash}`
}

/**
 * Get a block explorer URL for an address.
 */
export function getExplorerAddressUrl(chain: Chain, address: string): string {
  const config = CHAIN_METADATA[chain]
  return `${config.explorerUrl}/address/${address}`
}

/**
 * Get the human-readable display name for a chain.
 */
export function getChainDisplayName(chain: Chain): string {
  return CHAIN_METADATA[chain].displayName
}

/**
 * Get chain ID for a given chain.
 */
export function getChainId(chain: Chain): number {
  return CHAIN_METADATA[chain].chainIdOrNetwork as number
}
