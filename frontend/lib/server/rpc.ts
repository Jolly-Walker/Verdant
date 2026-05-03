/**
 * Server-only RPC utilities.
 *
 * This module MUST only be imported within /app/api/ server routes or other
 * server-only modules (lib/costPreview/, lib/data/). It accesses non-public
 * environment variables that would be undefined in the client bundle.
 */

import 'server-only'
import { Chain } from '@/types/chain'

const ALCHEMY_RPC_URLS: Record<Chain, string> = {
  ethereum: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_ETHEREUM || ''}`,
  arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_ARBITRUM || ''}`,
  base: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_BASE || ''}`,
  solana: `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_SOLANA || ''}`,
}

/**
 * Get the Alchemy RPC URL for a given chain.
 * Server-side only — will return a URL with an empty key if env vars are missing.
 */
export function getRpcUrl(chain: Chain): string {
  return ALCHEMY_RPC_URLS[chain]
}

/**
 * Fetch the current gas price from Alchemy for a given chain.
 * Returns gas price in Gwei. Falls back to hardcoded estimates on failure.
 */
export async function fetchGasPrice(chain: Chain): Promise<number> {
  const FALLBACK_GWEI: Record<Chain, number> = {
    ethereum: 25,
    arbitrum: 0.1,
    base: 0.1,
    solana: 0,
  }

  const rpcUrl = getRpcUrl(chain)
  if (!rpcUrl || rpcUrl.endsWith('/')) {
    return FALLBACK_GWEI[chain]
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return FALLBACK_GWEI[chain]
    }

    const json = await res.json()
    const gasPriceWei = parseInt(json.result, 16)
    return gasPriceWei / 1e9 // Convert wei to gwei
  } catch {
    console.warn(`Gas price fetch failed for ${chain}, using fallback`)
    return FALLBACK_GWEI[chain]
  }
}
