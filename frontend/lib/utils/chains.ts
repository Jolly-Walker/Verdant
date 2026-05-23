import { ChainId } from '@/types/shared'
import { CHAIN_DISPLAY_MAP } from '@/lib/plugins/chains/metadata'
import { DEMO_WALLET_ADDRESS } from '@/lib/demo/wallet'

/**
 * Validates if a string is a valid address for a given chain or any supported chain.
 */
export function isValidAddress(address: string, chain?: ChainId): boolean {
  if (address === DEMO_WALLET_ADDRESS) return true
  const evmRegex = /^0x[a-fA-F0-9]{40}$/
  const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

  if (chain === 'solana') return solanaRegex.test(address)
  if (chain) return evmRegex.test(address)

  // If no chain specified, check if it matches either format
  return evmRegex.test(address) || solanaRegex.test(address)
}

/**
 * Get a block explorer URL for a transaction hash.
 */
export function getExplorerTxUrl(chain: ChainId, txHash: string): string {
  const config = CHAIN_DISPLAY_MAP[chain]
  return `${config.explorerUrl}/tx/${txHash}`
}

/**
 * Get a block explorer URL for an address.
 */
export function getExplorerAddressUrl(chain: ChainId, address: string): string {
  const config = CHAIN_DISPLAY_MAP[chain]
  return `${config.explorerUrl}/address/${address}`
}

/**
 * Get the human-readable display name for a chain.
 */
export function getChainDisplayName(chain: ChainId): string {
  return CHAIN_DISPLAY_MAP[chain].displayName
}

/**
 * Get chain ID for a given chain.
 */
export function getChainId(chain: ChainId): number | string {
  return CHAIN_DISPLAY_MAP[chain].chainIdOrNetwork
}
