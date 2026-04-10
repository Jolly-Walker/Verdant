import { Chain } from '@/types/chain'
import { SUPPORTED_CHAINS } from '@/constants/chains'

/**
 * Get a block explorer URL for a transaction hash.
 */
export function getExplorerTxUrl(chain: Chain, txHash: string): string {
  const config = SUPPORTED_CHAINS[chain]
  return `${config.explorerUrl}/tx/${txHash}`
}

/**
 * Get a block explorer URL for an address.
 */
export function getExplorerAddressUrl(chain: Chain, address: string): string {
  const config = SUPPORTED_CHAINS[chain]
  return `${config.explorerUrl}/address/${address}`
}

/**
 * Get the human-readable display name for a chain.
 */
export function getChainDisplayName(chain: Chain): string {
  return SUPPORTED_CHAINS[chain].displayName
}

/**
 * Get chain ID for a given chain.
 */
export function getChainId(chain: Chain): number {
  return SUPPORTED_CHAINS[chain].chainId
}
