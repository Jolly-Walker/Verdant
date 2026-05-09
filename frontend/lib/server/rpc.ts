/**
 * Server-only RPC utilities.
 *
 * This module MUST only be imported within /app/api/ server routes or other
 * server-only modules (lib/costPreview/, lib/data/). It accesses non-public
 * environment variables that would be undefined in the client bundle.
 */

import 'server-only'
import { Chain } from '@/types/chain'
import { createPublicClient, http, PublicClient } from 'viem'
import { mainnet, arbitrum, base } from 'viem/chains'

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
 * Get a viem PublicClient for a given EVM chain.
 */
export function getPublicClient(chain: Chain): PublicClient {
  const rpcUrl = getRpcUrl(chain)
  
  const chainMap: Record<string, any> = {
    ethereum: mainnet,
    arbitrum: arbitrum,
    base: base,
  }

  const viemChain = chainMap[chain]
  if (!viemChain) {
    throw new Error(`Unsupported EVM chain: ${chain}`)
  }

  return createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl)
  })
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

  if (chain === 'solana') return 0

  try {
    const client = getPublicClient(chain)
    const gasPrice = await client.getGasPrice()
    return Number(gasPrice) / 1e9 // Convert wei to gwei
  } catch (err) {
    console.warn(`Gas price fetch failed for ${chain}, using fallback:`, err)
    return FALLBACK_GWEI[chain]
  }
}
